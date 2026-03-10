use anchor_lang::prelude::*;

declare_id!("4J3zdcXV1WNJDnMCaU3PpFzUkw9UgAwv7PtUSAuek94c");

#[program]
pub mod laplace_oracle {
    use super::*;

    /// Record a new prediction from an agent
    pub fn record_prediction(
        ctx: Context<RecordPrediction>,
        agent_id: String,
        token: String,
        direction: u8,       // 0 = bearish, 1 = bullish
        confidence: u16,     // 0-1000 (maps to 0.000-1.000)
        entry_price: u64,    // price in USD micro-cents (6 decimals)
        time_horizon: i64,   // resolution timestamp
    ) -> Result<()> {
        require!(direction <= 1, OracleError::InvalidDirection);
        require!(confidence <= 1000, OracleError::InvalidConfidence);
        require!(entry_price > 0, OracleError::InvalidPrice);

        let prediction = &mut ctx.accounts.prediction;
        prediction.agent_id = agent_id;
        prediction.token = token;
        prediction.direction = direction;
        prediction.confidence = confidence;
        prediction.entry_price = entry_price;
        prediction.time_horizon = time_horizon;
        prediction.recorded_at = Clock::get()?.unix_timestamp;
        prediction.resolved = false;
        prediction.outcome_price = 0;
        prediction.brier_score = 0;
        prediction.authority = ctx.accounts.authority.key();
        prediction.bump = ctx.bumps.prediction;

        let counter = &mut ctx.accounts.agent_counter;
        counter.count = counter.count.checked_add(1).unwrap();

        emit!(PredictionRecorded {
            agent_id: prediction.agent_id.clone(),
            token: prediction.token.clone(),
            direction,
            confidence,
            entry_price,
        });

        Ok(())
    }

    /// Initialize the agent counter (call once per agent)
    pub fn initialize_counter(
        ctx: Context<InitializeCounter>,
        agent_id: String,
    ) -> Result<()> {
        let counter = &mut ctx.accounts.agent_counter;
        counter.agent_id = agent_id;
        counter.count = 0;
        counter.bump = ctx.bumps.agent_counter;
        Ok(())
    }

    /// Resolve a prediction with the outcome price
    pub fn resolve_prediction(
        ctx: Context<ResolvePrediction>,
        outcome_price: u64,
    ) -> Result<()> {
        let prediction = &mut ctx.accounts.prediction;
        require!(!prediction.resolved, OracleError::AlreadyResolved);
        require!(outcome_price > 0, OracleError::InvalidPrice);

        prediction.resolved = true;
        prediction.outcome_price = outcome_price;

        // Calculate Brier Score: (confidence - outcome)^2
        // outcome: 1 if direction was correct, 0 otherwise
        let price_went_up = outcome_price > prediction.entry_price;
        let was_correct = (prediction.direction == 1 && price_went_up)
            || (prediction.direction == 0 && !price_went_up);

        let outcome_val: u64 = if was_correct { 1000 } else { 0 };
        let conf = prediction.confidence as u64;
        let diff = if conf > outcome_val {
            conf - outcome_val
        } else {
            outcome_val - conf
        };
        // Brier score scaled: (diff/1000)^2 * 1000000 for precision
        prediction.brier_score = (diff * diff) / 1000;

        emit!(PredictionResolved {
            agent_id: prediction.agent_id.clone(),
            token: prediction.token.clone(),
            was_correct,
            brier_score: prediction.brier_score,
        });

        Ok(())
    }
}

// === Accounts ===

#[derive(Accounts)]
#[instruction(agent_id: String)]
pub struct InitializeCounter<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + AgentCounter::INIT_SPACE,
        seeds = [b"counter", agent_id.as_bytes()],
        bump
    )]
    pub agent_counter: Account<'info, AgentCounter>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(agent_id: String, token: String, direction: u8, confidence: u16, entry_price: u64, time_horizon: i64)]
pub struct RecordPrediction<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Prediction::INIT_SPACE,
        seeds = [b"prediction", agent_id.as_bytes(), &agent_counter.count.to_le_bytes()],
        bump
    )]
    pub prediction: Account<'info, Prediction>,

    #[account(
        mut,
        seeds = [b"counter", agent_id.as_bytes()],
        bump = agent_counter.bump
    )]
    pub agent_counter: Account<'info, AgentCounter>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolvePrediction<'info> {
    #[account(
        mut,
        constraint = prediction.authority == authority.key()
    )]
    pub prediction: Account<'info, Prediction>,

    pub authority: Signer<'info>,
}

// === State ===

#[account]
#[derive(InitSpace)]
pub struct AgentCounter {
    #[max_len(64)]
    pub agent_id: String,
    pub count: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Prediction {
    #[max_len(64)]
    pub agent_id: String,
    #[max_len(16)]
    pub token: String,
    pub direction: u8,
    pub confidence: u16,
    pub entry_price: u64,
    pub time_horizon: i64,
    pub recorded_at: i64,
    pub resolved: bool,
    pub outcome_price: u64,
    pub brier_score: u64,
    pub authority: Pubkey,
    pub bump: u8,
}

// === Events ===

#[event]
pub struct PredictionRecorded {
    pub agent_id: String,
    pub token: String,
    pub direction: u8,
    pub confidence: u16,
    pub entry_price: u64,
}

#[event]
pub struct PredictionResolved {
    pub agent_id: String,
    pub token: String,
    pub was_correct: bool,
    pub brier_score: u64,
}

// === Errors ===

#[error_code]
pub enum OracleError {
    #[msg("Invalid direction. Must be 0 (bearish) or 1 (bullish)")]
    InvalidDirection,
    #[msg("Confidence must be between 0 and 1000")]
    InvalidConfidence,
    #[msg("Price must be greater than zero")]
    InvalidPrice,
    #[msg("Prediction already resolved")]
    AlreadyResolved,
}
