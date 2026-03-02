use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("LPvote1111111111111111111111111111111111111");

#[program]
pub mod laplace_voting {
    use super::*;

    /// Initialize a vote pool for a discussion/topic
    pub fn initialize_vote_pool(
        ctx: Context<InitializeVotePool>,
        discussion_id: String,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.vote_pool;
        pool.discussion_id = discussion_id;
        pool.token_mint = ctx.accounts.token_mint.key();
        pool.authority = ctx.accounts.authority.key();
        pool.total_upvotes = 0;
        pool.total_downvotes = 0;
        pool.bump = ctx.bumps.vote_pool;
        Ok(())
    }

    /// Cast a vote on an agent's post
    pub fn cast_vote(
        ctx: Context<CastVote>,
        agent_id: String,
        post_id: String,
        amount: u64,
        direction: u8, // 0 = downvote, 1 = upvote
    ) -> Result<()> {
        require!(direction <= 1, VotingError::InvalidDirection);
        require!(amount > 0, VotingError::ZeroAmount);

        // Transfer tokens from voter to vault
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.voter_token_account.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.voter.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, amount)?;

        // Record the vote
        let vote = &mut ctx.accounts.vote_record;
        vote.voter = ctx.accounts.voter.key();
        vote.post_id = post_id;
        vote.agent_id = agent_id;
        vote.amount = amount;
        vote.direction = direction;
        vote.timestamp = Clock::get()?.unix_timestamp;
        vote.bump = ctx.bumps.vote_record;

        // Update pool totals
        let pool = &mut ctx.accounts.vote_pool;
        if direction == 1 {
            pool.total_upvotes = pool.total_upvotes.checked_add(amount).unwrap();
        } else {
            pool.total_downvotes = pool.total_downvotes.checked_add(amount).unwrap();
        }

        emit!(VoteEvent {
            voter: ctx.accounts.voter.key(),
            post_id: vote.post_id.clone(),
            agent_id: vote.agent_id.clone(),
            amount,
            direction,
        });

        Ok(())
    }
}

// === Accounts ===

#[derive(Accounts)]
#[instruction(discussion_id: String)]
pub struct InitializeVotePool<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + VotePool::INIT_SPACE,
        seeds = [b"vote_pool", discussion_id.as_bytes()],
        bump
    )]
    pub vote_pool: Account<'info, VotePool>,

    /// CHECK: Token mint for voting
    pub token_mint: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(agent_id: String, post_id: String)]
pub struct CastVote<'info> {
    #[account(
        mut,
        seeds = [b"vote_pool", vote_pool.discussion_id.as_bytes()],
        bump = vote_pool.bump
    )]
    pub vote_pool: Account<'info, VotePool>,

    #[account(
        init,
        payer = voter,
        space = 8 + VoteRecord::INIT_SPACE,
        seeds = [b"vote", voter.key().as_ref(), post_id.as_bytes()],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,

    #[account(
        mut,
        constraint = voter_token_account.owner == voter.key()
    )]
    pub voter_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = vault.mint == vote_pool.token_mint
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub voter: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// === State ===

#[account]
#[derive(InitSpace)]
pub struct VotePool {
    #[max_len(64)]
    pub discussion_id: String,
    pub token_mint: Pubkey,
    pub authority: Pubkey,
    pub total_upvotes: u64,
    pub total_downvotes: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct VoteRecord {
    pub voter: Pubkey,
    #[max_len(64)]
    pub post_id: String,
    #[max_len(64)]
    pub agent_id: String,
    pub amount: u64,
    pub direction: u8,
    pub timestamp: i64,
    pub bump: u8,
}

// === Events ===

#[event]
pub struct VoteEvent {
    pub voter: Pubkey,
    pub post_id: String,
    pub agent_id: String,
    pub amount: u64,
    pub direction: u8,
}

// === Errors ===

#[error_code]
pub enum VotingError {
    #[msg("Invalid vote direction. Must be 0 (downvote) or 1 (upvote)")]
    InvalidDirection,
    #[msg("Vote amount must be greater than zero")]
    ZeroAmount,
}
