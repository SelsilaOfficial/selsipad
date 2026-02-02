Hybrid Admin Deployment Architecture
Overview
Migrate from "Instant Direct Deployment" to "Admin-Controlled Deployment with Token Escrow".

This resolves current issues:

❌ Long wait times in wizard → ✅ Instant submit, async deployment
❌ Verification failures → ✅ Admin can manually verify
❌ Complex frontend logic → ✅ Simple submit + escrow
❌ Gas spikes → ✅ Admin can batch during low gas
New User Flow (Fairlaunch/Presale)
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1-6: USER FILLS WIZARD (unchanged) │
│ • Token info, parameters, vesting, etc. │
└─────────────────────────────────────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 7: TOKEN ESCROW + CREATION FEE │
│ │
│ 1. User approves token transfer to Platform Escrow Contract │
│ 2. User transfers tokens to Escrow (tokensForSale amount) │
│ 3. User pays Creation Fee (e.g., 0.1 BNB) in same tx or next │
│ 4. Backend saves project: status = "PENDING_DEPLOY" │
│ 5. User sees confirmation: "Submitted! Check status in Profile"│
└─────────────────────────────────────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────────────┐
│ ADMIN DASHBOARD │
│ │
│ 1. Admin sees project in "Pending Deploy" queue │
│ 2. Fairlaunch: AUTO-APPROVED (SC scan done in wizard) │
│ 3. Admin clicks "Deploy" → Backend deploys contract │
│ 4. Backend transfers tokens from Escrow to deployed contract │
│ 5. Status updates: "LIVE" + appears in Explore │
└─────────────────────────────────────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────────────┐
│ DEVELOPER DASHBOARD (Profile → My Projects) │
│ │
│ User can view: │
│ • All submitted projects │
│ • Status: DRAFT | PENDING_DEPLOY | LIVE | PAUSED | ENDED │
│ • Contract address & explorer link (when deployed) │
│ • Admin can PAUSE project if developer is problematic │
└─────────────────────────────────────────────────────────────────┘
Status Lifecycle
Status Description Visible in Explore?
DRAFT User is still editing ❌ No
PENDING_DEPLOY Tokens escrowed, fee paid ✅ Yes (Upcoming)
LIVE Admin deployed contract ✅ Yes (Active)
PAUSED Admin paused (dev issue) ⚠️ Yes (Paused badge)
ENDED Sale period finished ✅ Yes (Ended)
FINALIZED Liquidity added, complete ✅ Yes (Finalized)
NOTE

Fairlaunch is AUTO-APPROVED because SC scan is already done in wizard (Step 1). Admin role is simplified to: Deploy & (optional) Pause if developer is problematic.

Fee Structure (from Modul 15)
Creation Fees (paid at submit)
Type BSC ETH Solana
Fairlaunch 0.2 BNB 0.1 ETH 1 SOL
Presale 0.5 BNB 0.1 ETH 1 SOL
Bonding Curve - - 0.5 SOL
Success Fees (5% from raised amount, when softcap reached)
Recipient Share
Treasury 2.5%
Referral Rewards 2%
SBT Stakers 0.5%
Required Changes
Phase 1: Smart Contract - Escrow System
[NEW] EscrowVault.sol
Holds tokens for projects pending deployment
Functions: deposit(projectId, tokenAddress, amount), release(projectId, toContract), refund(projectId)
Only Platform Admin can call release and refund
Emits events for tracking
WARNING

This is a new contract that needs auditing before mainnet.

Phase 2: Database Schema Updates
[MODIFY] launch_rounds table
Add new columns:

escrow_tx_hash TEXT, -- TX when tokens were escrowed
escrow_amount NUMERIC, -- Amount in escrow
creation_fee_paid NUMERIC, -- Fee paid in native token
creation_fee_tx_hash TEXT, -- TX for fee payment
admin_reviewer_id UUID, -- Which admin deployed
admin_review_at TIMESTAMPTZ, -- When admin reviewed
rejection_reason TEXT -- If rejected, why
[MODIFY] Status enum
Add: PENDING_REVIEW, APPROVED (already exists), update constraints.

Phase 3: Backend API Changes
[MODIFY] POST /api/fairlaunch/deploy → POST /api/fairlaunch/submit
No longer deploys contract
Validates escrow transaction
Saves project with status PENDING_REVIEW
Returns projectId and launchRoundId
[NEW] POST /api/admin/fairlaunch/deploy
Admin-only endpoint
Deploys contract using Platform Wallet
Transfers tokens from Escrow to contract
Updates status to LIVE
[NEW] POST /api/admin/fairlaunch/reject
Admin rejects project
Triggers escrow refund
Updates status to REJECTED with reason
[NEW] GET /api/user/projects
Returns all projects for authenticated user
Used by Developer Dashboard
Phase 4: Frontend - Wizard Changes
[MODIFY]
DeployStep.tsx
→ SubmitStep.tsx
Remove all deployment logic
Add Token Escrow flow:
"Approve Token" button
"Transfer to Escrow" button
"Pay Creation Fee" button
Show success state: "Submitted! View in My Projects"
[MODIFY]
CreateFairlaunchWizard.tsx
Remove
handleDeploy
function
Add handleSubmit function for escrow + fee
Phase 5: Frontend - Developer Dashboard
[NEW] app/profile/projects/page.tsx
Developer Project Dashboard with:

List of all user's projects (Fairlaunch + Presale)
Status badges (color-coded)
Click to view project details
Rejection reason display
[NEW] components/developer/ProjectStatusCard.tsx
Card component showing:

Project name + logo
Type (Fairlaunch/Presale)
Status badge
Quick actions (View, Edit if DRAFT)
Phase 6: Admin Dashboard Updates
[MODIFY] Admin Fairlaunch Review Page
Add "Deploy" button for PENDING_REVIEW projects
Add "Reject" button with reason input
Show escrow details (token amount, TX hash)
Real-time status updates after deployment
Estimation
Phase Effort Priority
Phase 1: Escrow Contract 2-3 days 🔴 Critical
Phase 2: Database Schema 1 day 🔴 Critical
Phase 3: Backend APIs 2 days 🔴 Critical
Phase 4: Wizard Changes 1-2 days 🔴 Critical
Phase 5: Developer Dashboard 1-2 days 🟡 High
Phase 6: Admin Dashboard 1 day 🟡 High
Total: ~8-11 days

Open Questions (ANSWERED)
✅ Creation Fee Amount: Fairlaunch = 0.2 BNB, Presale = 0.5 BNB (from Modul 15)
⬜ Escrow Contract Location: Deploy on BSC Testnet first for testing?
✅ Rejection: N/A for Fairlaunch (auto-approved). Admin can PAUSE live projects.
✅ Same flow for Presale?: Yes, but Presale may need additional admin review.
Next Steps
⬜ User confirms plan & answers open questions
⬜ Create Escrow smart contract
⬜ Deploy Escrow to BSC Testnet
⬜ Apply database migrations
⬜ Update backend APIs
⬜ Update wizard frontend
⬜ Build Developer Dashboard
⬜ Update Admin Dashboard
⬜ End-to-end testing

Comment
Ctrl+Alt+M
