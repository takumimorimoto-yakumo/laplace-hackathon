use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("LPrent1111111111111111111111111111111111111");

#[program]
pub mod laplace_rental {
    use super::*;

    /// Set pricing for an agent's subscription
    pub fn set_pricing(
        ctx: Context<SetPricing>,
        agent_id: String,
        plan_type: u8,          // 0 = flat_only, 1 = monthly + performance
        monthly_price: u64,     // in token smallest units
        perf_fee_tiers: [u16; 4], // bps: [100, 200, 300, 500]
    ) -> Result<()> {
        require!(plan_type <= 1, RentalError::InvalidPlanType);
        for tier in perf_fee_tiers.iter() {
            require!(*tier <= 10000, RentalError::InvalidFeeTier);
        }

        let pricing = &mut ctx.accounts.agent_pricing;
        pricing.agent_id = agent_id;
        pricing.authority = ctx.accounts.authority.key();
        pricing.plan_type = plan_type;
        pricing.monthly_price = monthly_price;
        pricing.perf_fee_tiers = perf_fee_tiers;
        pricing.payment_mint = ctx.accounts.payment_mint.key();
        pricing.total_subscribers = 0;
        pricing.bump = ctx.bumps.agent_pricing;

        Ok(())
    }

    /// Subscribe to an agent's signals
    pub fn subscribe(
        ctx: Context<Subscribe>,
        agent_id: String,
        payment_amount: u64,
    ) -> Result<()> {
        require!(payment_amount > 0, RentalError::ZeroPayment);

        let pricing = &ctx.accounts.agent_pricing;

        // Check if payment covers monthly price (10% discount for SKR token)
        let required = pricing.monthly_price;
        require!(payment_amount >= required, RentalError::InsufficientPayment);

        // Transfer payment to vault
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.subscriber_token_account.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.subscriber.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, payment_amount)?;

        let sub = &mut ctx.accounts.subscription;
        sub.subscriber = ctx.accounts.subscriber.key();
        sub.agent_id = agent_id;
        sub.started_at = Clock::get()?.unix_timestamp;
        sub.expires_at = sub.started_at + 30 * 24 * 60 * 60; // 30 days
        sub.payment_amount = payment_amount;
        sub.high_water_mark = 0; // Set when first portfolio value recorded
        sub.active = true;
        sub.bump = ctx.bumps.subscription;

        // Update subscriber count
        let pricing_mut = &mut ctx.accounts.agent_pricing;
        pricing_mut.total_subscribers = pricing_mut.total_subscribers.checked_add(1).unwrap();

        emit!(SubscriptionCreated {
            subscriber: ctx.accounts.subscriber.key(),
            agent_id: sub.agent_id.clone(),
            expires_at: sub.expires_at,
        });

        Ok(())
    }

    /// Claim performance fee based on returns
    pub fn claim_performance_fee(
        ctx: Context<ClaimPerformanceFee>,
        return_pct: u16, // basis points of return (e.g., 500 = 5%)
    ) -> Result<()> {
        let sub = &mut ctx.accounts.subscription;
        let pricing = &ctx.accounts.agent_pricing;

        require!(sub.active, RentalError::InactiveSubscription);
        require!(pricing.plan_type == 1, RentalError::NoPerformanceFee);

        // Only charge fee on positive returns above high water mark
        require!(return_pct > 0, RentalError::NoPositiveReturn);

        // Determine fee tier based on return percentage
        let fee_bps = if return_pct >= 2000 {
            pricing.perf_fee_tiers[3] // 20%+ returns
        } else if return_pct >= 1000 {
            pricing.perf_fee_tiers[2] // 10%+ returns
        } else if return_pct >= 500 {
            pricing.perf_fee_tiers[1] // 5%+ returns
        } else {
            pricing.perf_fee_tiers[0] // < 5% returns
        };

        // Update high water mark
        sub.high_water_mark = return_pct;

        emit!(PerformanceFeeClaimed {
            subscriber: sub.subscriber,
            agent_id: sub.agent_id.clone(),
            return_pct,
            fee_bps,
        });

        Ok(())
    }

    /// Unsubscribe from an agent
    pub fn unsubscribe(ctx: Context<Unsubscribe>) -> Result<()> {
        let sub = &mut ctx.accounts.subscription;
        require!(sub.active, RentalError::InactiveSubscription);
        sub.active = false;

        let pricing = &mut ctx.accounts.agent_pricing;
        pricing.total_subscribers = pricing.total_subscribers.saturating_sub(1);

        emit!(SubscriptionCancelled {
            subscriber: sub.subscriber,
            agent_id: sub.agent_id.clone(),
        });

        Ok(())
    }
}

// === Accounts ===

#[derive(Accounts)]
#[instruction(agent_id: String)]
pub struct SetPricing<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + AgentPricing::INIT_SPACE,
        seeds = [b"pricing", agent_id.as_bytes()],
        bump
    )]
    pub agent_pricing: Account<'info, AgentPricing>,

    /// CHECK: Payment token mint
    pub payment_mint: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(agent_id: String)]
pub struct Subscribe<'info> {
    #[account(
        mut,
        seeds = [b"pricing", agent_id.as_bytes()],
        bump = agent_pricing.bump
    )]
    pub agent_pricing: Account<'info, AgentPricing>,

    #[account(
        init,
        payer = subscriber,
        space = 8 + Subscription::INIT_SPACE,
        seeds = [b"sub", subscriber.key().as_ref(), agent_id.as_bytes()],
        bump
    )]
    pub subscription: Account<'info, Subscription>,

    #[account(
        mut,
        constraint = subscriber_token_account.owner == subscriber.key()
    )]
    pub subscriber_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = vault.mint == agent_pricing.payment_mint
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub subscriber: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimPerformanceFee<'info> {
    #[account(
        mut,
        constraint = subscription.subscriber == authority.key() || subscription.agent_id == agent_pricing.agent_id
    )]
    pub subscription: Account<'info, Subscription>,

    pub agent_pricing: Account<'info, AgentPricing>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Unsubscribe<'info> {
    #[account(
        mut,
        constraint = subscription.subscriber == subscriber.key()
    )]
    pub subscription: Account<'info, Subscription>,

    #[account(
        mut,
        seeds = [b"pricing", subscription.agent_id.as_bytes()],
        bump = agent_pricing.bump
    )]
    pub agent_pricing: Account<'info, AgentPricing>,

    pub subscriber: Signer<'info>,
}

// === State ===

#[account]
#[derive(InitSpace)]
pub struct AgentPricing {
    #[max_len(64)]
    pub agent_id: String,
    pub authority: Pubkey,
    pub plan_type: u8,
    pub monthly_price: u64,
    pub perf_fee_tiers: [u16; 4],
    pub payment_mint: Pubkey,
    pub total_subscribers: u32,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Subscription {
    pub subscriber: Pubkey,
    #[max_len(64)]
    pub agent_id: String,
    pub started_at: i64,
    pub expires_at: i64,
    pub payment_amount: u64,
    pub high_water_mark: u16,
    pub active: bool,
    pub bump: u8,
}

// === Events ===

#[event]
pub struct SubscriptionCreated {
    pub subscriber: Pubkey,
    pub agent_id: String,
    pub expires_at: i64,
}

#[event]
pub struct SubscriptionCancelled {
    pub subscriber: Pubkey,
    pub agent_id: String,
}

#[event]
pub struct PerformanceFeeClaimed {
    pub subscriber: Pubkey,
    pub agent_id: String,
    pub return_pct: u16,
    pub fee_bps: u16,
}

// === Errors ===

#[error_code]
pub enum RentalError {
    #[msg("Invalid plan type. Must be 0 (flat) or 1 (monthly + performance)")]
    InvalidPlanType,
    #[msg("Fee tier must be between 0 and 10000 bps")]
    InvalidFeeTier,
    #[msg("Payment amount must be greater than zero")]
    ZeroPayment,
    #[msg("Insufficient payment for subscription")]
    InsufficientPayment,
    #[msg("Subscription is not active")]
    InactiveSubscription,
    #[msg("This plan does not include performance fees")]
    NoPerformanceFee,
    #[msg("No positive return to charge fee on")]
    NoPositiveReturn,
}
