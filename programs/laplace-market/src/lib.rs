use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("EGQ3JFpTFUNfKZ41uKMx73gQ4Cwd8SLPjVjrdoY48od7");

/// Bet types for prediction markets
/// 0 = single (pick 1 winner)
/// 1 = top3 (pick top 3 in any order)
/// 2 = dual (pick 2 winners)
/// 3 = triple (pick 3 winners)
/// 4 = exact_order (pick top 3 in exact order)

#[program]
pub mod laplace_market {
    use super::*;

    /// Create a new prediction contest
    pub fn create_contest(
        ctx: Context<CreateContest>,
        contest_id: String,
        period_type: u8,     // 0 = daily, 1 = weekly, 2 = monthly
        starts_at: i64,
        ends_at: i64,
    ) -> Result<()> {
        require!(period_type <= 2, MarketError::InvalidPeriodType);
        require!(ends_at > starts_at, MarketError::InvalidTimeRange);

        let contest = &mut ctx.accounts.contest;
        contest.contest_id = contest_id;
        contest.authority = ctx.accounts.authority.key();
        contest.period_type = period_type;
        contest.starts_at = starts_at;
        contest.ends_at = ends_at;
        contest.total_pool = 0;
        contest.total_positions = 0;
        contest.resolved = false;
        contest.winners = [Pubkey::default(); 3];
        contest.payment_mint = ctx.accounts.payment_mint.key();
        contest.bump = ctx.bumps.contest;

        emit!(ContestCreated {
            contest_id: contest.contest_id.clone(),
            period_type,
            starts_at,
            ends_at,
        });

        Ok(())
    }

    /// Place a position (bet) on a contest
    pub fn place_position(
        ctx: Context<PlacePosition>,
        contest_id: String,
        position_type: u8,
        agent_selections: [Pubkey; 3],
        amount: u64,
    ) -> Result<()> {
        require!(position_type <= 4, MarketError::InvalidPositionType);
        require!(amount > 0, MarketError::ZeroAmount);

        let contest = &ctx.accounts.contest;
        let now = Clock::get()?.unix_timestamp;
        require!(now >= contest.starts_at, MarketError::ContestNotStarted);
        require!(now < contest.ends_at, MarketError::ContestEnded);
        require!(!contest.resolved, MarketError::ContestResolved);

        // Transfer tokens to contest vault
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.predictor_token_account.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.predictor.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, amount)?;

        let position = &mut ctx.accounts.position;
        position.predictor = ctx.accounts.predictor.key();
        position.contest_id = contest_id;
        position.position_type = position_type;
        position.agent_selections = agent_selections;
        position.amount = amount;
        position.placed_at = now;
        position.claimed = false;
        position.bump = ctx.bumps.position;

        // Update contest pool
        let contest_mut = &mut ctx.accounts.contest;
        contest_mut.total_pool = contest_mut.total_pool.checked_add(amount).unwrap();
        contest_mut.total_positions = contest_mut.total_positions.checked_add(1).unwrap();

        emit!(PositionPlaced {
            predictor: ctx.accounts.predictor.key(),
            contest_id: position.contest_id.clone(),
            position_type,
            amount,
        });

        Ok(())
    }

    /// Resolve a contest with winners
    pub fn resolve_contest(
        ctx: Context<ResolveContest>,
        winners: [Pubkey; 3],
    ) -> Result<()> {
        let contest = &mut ctx.accounts.contest;
        require!(!contest.resolved, MarketError::ContestResolved);

        let now = Clock::get()?.unix_timestamp;
        require!(now >= contest.ends_at, MarketError::ContestNotEnded);

        contest.resolved = true;
        contest.winners = winners;

        emit!(ContestResolved {
            contest_id: contest.contest_id.clone(),
            winners,
        });

        Ok(())
    }

    /// Claim winnings from a resolved contest
    pub fn claim_winnings(
        ctx: Context<ClaimWinnings>,
    ) -> Result<()> {
        let position = &mut ctx.accounts.position;
        let contest = &ctx.accounts.contest;

        require!(contest.resolved, MarketError::ContestNotResolved);
        require!(!position.claimed, MarketError::AlreadyClaimed);

        // Check if position is a winner based on position_type
        let is_winner = match position.position_type {
            0 => {
                // Single: first selection matches first winner
                position.agent_selections[0] == contest.winners[0]
            }
            1 => {
                // Top3: all 3 selections in winners (any order)
                let selections = position.agent_selections;
                let winners = contest.winners;
                selections.iter().all(|s| winners.contains(s))
            }
            2 => {
                // Dual: first 2 selections in top 3
                let winners = contest.winners;
                winners.contains(&position.agent_selections[0])
                    && winners.contains(&position.agent_selections[1])
            }
            3 => {
                // Triple: all 3 match (any order)
                let selections = position.agent_selections;
                let winners = contest.winners;
                selections.iter().all(|s| winners.contains(s))
            }
            4 => {
                // Exact order: all 3 match in exact order
                position.agent_selections == contest.winners
            }
            _ => false,
        };

        require!(is_winner, MarketError::NotAWinner);

        position.claimed = true;

        // Payout calculation: total_pool * 0.9 / number_of_winners
        // (10% rake for platform)
        // Actual payout transfer would happen via vault PDA signer
        // For hackathon demo, we emit the event and mark as claimed

        emit!(WinningsClaimed {
            predictor: position.predictor,
            contest_id: position.contest_id.clone(),
            amount: position.amount,
        });

        Ok(())
    }
}

// === Accounts ===

#[derive(Accounts)]
#[instruction(contest_id: String)]
pub struct CreateContest<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Contest::INIT_SPACE,
        seeds = [b"contest", contest_id.as_bytes()],
        bump
    )]
    pub contest: Account<'info, Contest>,

    /// CHECK: Payment token mint
    pub payment_mint: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(contest_id: String)]
pub struct PlacePosition<'info> {
    #[account(
        mut,
        seeds = [b"contest", contest_id.as_bytes()],
        bump = contest.bump
    )]
    pub contest: Account<'info, Contest>,

    #[account(
        init,
        payer = predictor,
        space = 8 + Position::INIT_SPACE,
        seeds = [b"position", predictor.key().as_ref(), contest_id.as_bytes()],
        bump
    )]
    pub position: Account<'info, Position>,

    #[account(
        mut,
        constraint = predictor_token_account.owner == predictor.key()
    )]
    pub predictor_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = vault.mint == contest.payment_mint
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub predictor: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveContest<'info> {
    #[account(
        mut,
        constraint = contest.authority == authority.key()
    )]
    pub contest: Account<'info, Contest>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(
        mut,
        constraint = position.predictor == predictor.key()
    )]
    pub position: Account<'info, Position>,

    #[account(
        constraint = contest.contest_id == position.contest_id
    )]
    pub contest: Account<'info, Contest>,

    pub predictor: Signer<'info>,
}

// === State ===

#[account]
#[derive(InitSpace)]
pub struct Contest {
    #[max_len(64)]
    pub contest_id: String,
    pub authority: Pubkey,
    pub period_type: u8,
    pub starts_at: i64,
    pub ends_at: i64,
    pub total_pool: u64,
    pub total_positions: u32,
    pub resolved: bool,
    pub winners: [Pubkey; 3],
    pub payment_mint: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Position {
    pub predictor: Pubkey,
    #[max_len(64)]
    pub contest_id: String,
    pub position_type: u8,
    pub agent_selections: [Pubkey; 3],
    pub amount: u64,
    pub placed_at: i64,
    pub claimed: bool,
    pub bump: u8,
}

// === Events ===

#[event]
pub struct ContestCreated {
    pub contest_id: String,
    pub period_type: u8,
    pub starts_at: i64,
    pub ends_at: i64,
}

#[event]
pub struct PositionPlaced {
    pub predictor: Pubkey,
    pub contest_id: String,
    pub position_type: u8,
    pub amount: u64,
}

#[event]
pub struct ContestResolved {
    pub contest_id: String,
    pub winners: [Pubkey; 3],
}

#[event]
pub struct WinningsClaimed {
    pub predictor: Pubkey,
    pub contest_id: String,
    pub amount: u64,
}

// === Errors ===

#[error_code]
pub enum MarketError {
    #[msg("Invalid period type. Must be 0 (daily), 1 (weekly), or 2 (monthly)")]
    InvalidPeriodType,
    #[msg("End time must be after start time")]
    InvalidTimeRange,
    #[msg("Invalid position type. Must be 0-4")]
    InvalidPositionType,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Contest has not started yet")]
    ContestNotStarted,
    #[msg("Contest has ended")]
    ContestEnded,
    #[msg("Contest is already resolved")]
    ContestResolved,
    #[msg("Contest has not ended yet")]
    ContestNotEnded,
    #[msg("Contest has not been resolved yet")]
    ContestNotResolved,
    #[msg("Position is not a winning position")]
    NotAWinner,
    #[msg("Winnings already claimed")]
    AlreadyClaimed,
}
