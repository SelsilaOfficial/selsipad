Hybrid Admin Deployment - Task Breakdown
Phase 1: Smart Contract - Escrow System (2-3 days)
1.1 EscrowVault Contract
Create EscrowVault.sol contract structure
Implement deposit(projectId, tokenAddress, amount) function
Implement release(projectId, toContract) function (admin only)
Implement refund(projectId) function (admin only)
Add access control (Ownable/AccessControl)
Emit events: Deposited, Released, Refunded
Add view functions:
getBalance(projectId)
, getDeposit(projectId)
1.2 Fee Receiver Contract (optional)
Create FeeReceiver.sol for creation fee collection
Or: Use existing Treasury wallet directly
1.3 Contract Testing & Deployment
Write unit tests for EscrowVault
Deploy to BSC Testnet
Verify on BSCScan
Save deployment addresses to config
Phase 2: Database Schema (1 day)
2.1 Migration: launch_rounds table
Add column: escrow_tx_hash TEXT
Add column: escrow_amount NUMERIC
Add column: creation_fee_paid NUMERIC
Add column: creation_fee_tx_hash TEXT
Add column: admin_deployer_id UUID
Add column: deployed_at TIMESTAMPTZ
Add column: paused_at TIMESTAMPTZ
Add column: pause_reason TEXT
2.2 Status Enum Update
Add status: PENDING_DEPLOY
Add status: PAUSED
Add status: FINALIZED
Update check constraints
2.3 Config Table (optional)
Create platform_config table for fee amounts
Add fee configuration per chain
Phase 3: Backend API (2 days)
3.1 Submit API (replaces Deploy API)
Create POST /api/fairlaunch/submit
Validate escrow transaction on-chain
Validate creation fee payment
Save project with status PENDING_DEPLOY
Return projectId and launchRoundId
Add logging and error handling
3.2 Admin Deploy API
Create POST /api/admin/fairlaunch/deploy
Add admin-only middleware
Deploy contract using Platform Wallet
Call EscrowVault.release() to transfer tokens
Update status to LIVE
Queue verification job
Return contract address and TX hash
3.3 Admin Pause API
Create POST /api/admin/fairlaunch/pause
Update status to PAUSED
Store pause reason
(Optional) Call contract pause function
3.4 User Projects API
Create GET /api/user/projects
Return all projects for authenticated user
Include status, escrow info, contract address
Support filtering by type (Fairlaunch/Presale)
3.5 Fee Configuration API
Create GET /api/config/fees
Return fee amounts per chain and type
Cache for performance
Phase 4: Frontend - Wizard Changes (1-2 days)
4.1 Rename DeployStep to SubmitStep
Rename file:
DeployStep.tsx
→ SubmitStep.tsx
Update imports in wizard
4.2 Implement Token Escrow Flow
Add "Approve Token" button with wagmi
Add "Send to Escrow" button
Show TX confirmation status
Handle approval errors
4.3 Implement Creation Fee Payment
Fetch fee amount from API
Add "Pay Creation Fee" button
Handle BSC/ETH native token transfer
Show TX confirmation
4.4 Submit to Backend
Call POST /api/fairlaunch/submit
Pass escrow TX hash and fee TX hash
Handle success: redirect to profile/projects
4.5 Update Wizard Flow
Remove old deployment logic from wizard
Update step labels
Add success state UI
Phase 5: Developer Dashboard (1-2 days)
5.1 Projects List Page
Create app/profile/projects/page.tsx
Fetch user projects from API
Display list with status badges
Add filtering (All, Fairlaunch, Presale)
5.2 Project Status Card
Create components/developer/ProjectStatusCard.tsx
Show project name, logo, type
Color-coded status badge
Actions: View, Edit (if DRAFT)
5.3 Status Badge Component
Create components/developer/ProjectStatusBadge.tsx
DRAFT: Gray
PENDING_DEPLOY: Yellow (with animation)
LIVE: Green
PAUSED: Red
ENDED: Blue
FINALIZED: Purple
5.4 Profile Navigation
Add "My Projects" link to profile menu
Add badge count for pending projects
Phase 6: Admin Dashboard (1 day)
6.1 Pending Deploy Queue
Add "Pending Deploy" tab to admin fairlaunch page
List all PENDING_DEPLOY projects
Show project details, escrow info
6.2 Deploy Action
Add "Deploy" button per project
Confirmation modal with details
Show deployment progress
Handle success/error states
6.3 Pause Action
Add "Pause" button for LIVE projects
Require reason input
Confirmation dialog
Update UI immediately
6.4 Real-time Updates
(Optional) WebSocket for status updates
Or: Polling every 30 seconds
Phase 7: Testing & Polish (1 day)
7.1 End-to-End Testing
Test full wizard flow
Test escrow deposit
Test admin deploy
Test pause/unpause
Test developer dashboard
7.2 Error Handling
Add user-friendly error messages
Handle RPC failures gracefully
Add retry logic where needed
7.3 Documentation
Update developer flow guide
Update admin guide
Add API documentation
Summary
Phase Tasks Estimated
Phase 1 10 2-3 days
Phase 2 11 1 day
Phase 3 14 2 days
Phase 4 10 1-2 days
Phase 5 8 1-2 days
Phase 6 8 1 day
Phase 7 6 1 day
Total 67 tasks 9-12 days

Comment
Ctrl+Alt+M
