use anchor_lang::prelude::*;

declare_id!("LPreg11111111111111111111111111111111111111");

#[program]
pub mod laplace_registry {
    use super::*;

    /// Register a new AI agent on-chain
    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        agent_id: String,
        name: String,
        llm_model: String,
    ) -> Result<()> {
        let record = &mut ctx.accounts.agent_record;
        record.agent_id = agent_id;
        record.name = name;
        record.llm_model = llm_model;
        record.authority = ctx.accounts.authority.key();
        record.accuracy = 0;
        record.calibration = 0;
        record.total_predictions = 0;
        record.total_votes = 0;
        record.registered_at = Clock::get()?.unix_timestamp;
        record.bump = ctx.bumps.agent_record;

        emit!(AgentRegistered {
            agent_id: record.agent_id.clone(),
            name: record.name.clone(),
        });

        Ok(())
    }

    /// Update agent's performance scores
    pub fn update_score(
        ctx: Context<UpdateScore>,
        accuracy: u16,       // 0-1000 (0.0% - 100.0%)
        calibration: u16,    // 0-1000 (lower = better calibrated)
        total_predictions: u32,
        total_votes: u64,
    ) -> Result<()> {
        require!(accuracy <= 1000, RegistryError::InvalidScore);
        require!(calibration <= 1000, RegistryError::InvalidScore);

        let record = &mut ctx.accounts.agent_record;
        record.accuracy = accuracy;
        record.calibration = calibration;
        record.total_predictions = total_predictions;
        record.total_votes = total_votes;

        emit!(ScoreUpdated {
            agent_id: record.agent_id.clone(),
            accuracy,
            calibration,
            total_predictions,
        });

        Ok(())
    }
}

// === Accounts ===

#[derive(Accounts)]
#[instruction(agent_id: String)]
pub struct RegisterAgent<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + AgentRecord::INIT_SPACE,
        seeds = [b"agent", agent_id.as_bytes()],
        bump
    )]
    pub agent_record: Account<'info, AgentRecord>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateScore<'info> {
    #[account(
        mut,
        constraint = agent_record.authority == authority.key()
    )]
    pub agent_record: Account<'info, AgentRecord>,

    pub authority: Signer<'info>,
}

// === State ===

#[account]
#[derive(InitSpace)]
pub struct AgentRecord {
    #[max_len(64)]
    pub agent_id: String,
    #[max_len(64)]
    pub name: String,
    #[max_len(32)]
    pub llm_model: String,
    pub authority: Pubkey,
    pub accuracy: u16,
    pub calibration: u16,
    pub total_predictions: u32,
    pub total_votes: u64,
    pub registered_at: i64,
    pub bump: u8,
}

// === Events ===

#[event]
pub struct AgentRegistered {
    pub agent_id: String,
    pub name: String,
}

#[event]
pub struct ScoreUpdated {
    pub agent_id: String,
    pub accuracy: u16,
    pub calibration: u16,
    pub total_predictions: u32,
}

// === Errors ===

#[error_code]
pub enum RegistryError {
    #[msg("Score value must be between 0 and 1000")]
    InvalidScore,
}
