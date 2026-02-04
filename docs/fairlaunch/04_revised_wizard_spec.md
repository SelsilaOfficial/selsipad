# Fairlaunch Wizard - Revised Specification

> **🎯 Simplified 7-Step Flow**: No KYC, Auto SC Scan, Auto Deploy
>
> **Philosophy**: Fairlaunch is permissionless - focus on token security, not developer identity

---

## 🆕 Key Changes from Current Design

| Aspect              | Old Design                 | New Design          |
| ------------------- | -------------------------- | ------------------- |
| **KYC Requirement** | ✅ Required (Step 7)       | ❌ NOT required     |
| **Token Selection** | Step 2 (mixed with params) | Step 1 (dedicated)  |
| **SC Scan**         | Manual trigger             | Auto on token input |
| **Admin Review**    | Required before deploy     | ❌ Auto-deploy      |
| **Badge Logic**     | Manual assignment          | Auto based on scan  |
| **Social Media**    | Basic only                 | All platforms       |

---

## 📋 New 7-Step Flow

### **Step 1: Network & Token Selection** 🌐

**Purpose:** Choose blockchain and token source

**UI Sections:**

#### 1.1 Network Selection

```typescript
<div>
  <label>Select Network</label>
  <select value={network} onChange={handleNetworkChange}>
    <option value="ethereum">Ethereum</option>
    <option value="bnb">BNB Chain</option>
    <option value="base">Base</option>
    <option value="sepolia">Sepolia Testnet</option>
    <option value="bsc_testnet">BSC Testnet</option>
    <option value="base_sepolia">Base Sepolia</option>
  </select>
</div>
```

#### 1.2 Token Mode Selection

```typescript
<div className="grid grid-cols-2 gap-4">
  {/* Option 1: Use Existing Token */}
  <button
    onClick={() => setTokenMode('existing')}
    className={tokenMode === 'existing' ? 'selected' : ''}
  >
    <div className="icon">🔍</div>
    <h3>Use Existing Token</h3>
    <p>Import your deployed token</p>
    <div className="badge-preview">
      Badge: SC Pass ✓
    </div>
  </button>

  {/* Option 2: Create via Factory */}
  <button
    onClick={() => setTokenMode('create')}
    className={tokenMode === 'create' ? 'selected' : ''}
  >
    <div className="icon">⚡</div>
    <h3>Create New Token</h3>
    <p>Deploy via our factory</p>
    <div className="badge-preview">
      Badges: SAFU ✓ + SC Pass ✓
    </div>
  </button>
</div>
```

#### 1.3A If "Use Existing Token"

```typescript
<div>
  <label>Token Contract Address</label>
  <input
    type="text"
    value={tokenAddress}
    onChange={handleTokenAddressChange}
    placeholder="0x..."
  />

  {/* Auto-trigger scan on input */}
  {isScanning && (
    <div className="scanning-indicator">
      🔍 Scanning contract for security issues...
    </div>
  )}

  {scanResult && (
    <div className={`scan-result ${scanResult.status}`}>
      <h4>Security Scan Results:</h4>

      {/* Anti-Mint Check */}
      <div className="check-item">
        <span className={scanResult.checks.antiMint.pass ? 'pass' : 'fail'}>
          {scanResult.checks.antiMint.pass ? '✓' : '✗'}
        </span>
        Anti-Mint: {scanResult.checks.antiMint.message}
      </div>

      {/* Honeypot Check */}
      <div className="check-item">
        <span className={scanResult.checks.honeypot.pass ? 'pass' : 'fail'}>
          {scanResult.checks.honeypot.pass ? '✓' : '✗'}
        </span>
        Honeypot: {scanResult.checks.honeypot.message}
      </div>

      {/* Tax Check */}
      <div className="check-item">
        <span className={scanResult.checks.tax.pass ? 'pass' : 'fail'}>
          {scanResult.checks.tax.pass ? '✓' : '✗'}
        </span>
        Tax/Fee: {scanResult.checks.tax.message}
      </div>

      {/* Pause Check */}
      <div className="check-item">
        <span className={scanResult.checks.pause.pass ? 'pass' : 'fail'}>
          {scanResult.checks.pause.pass ? '✓' : '✗'}
        </span>
        No Pause: {scanResult.checks.pause.message}
      </div>

      {/* Overall Result */}
      {scanResult.allPassed ? (
        <div className="success-badge">
          🎉 All checks passed! Badge: SC Pass ✓
        </div>
      ) : (
        <div className="error-message">
          ❌ Security scan failed. Please fix issues or use factory token.
          <button onClick={() => setTokenMode('create')}>
            Create Safe Token Instead
          </button>
        </div>
      )}
    </div>
  )}
</div>
```

#### 1.3B If "Create via Factory"

```typescript
<CreateTokenDialog
  network={network}
  onTokenCreated={(address) => {
    setTokenAddress(address);
    // Auto-assign badges
    setBadges(['SAFU', 'SC_PASS']);
  }}
/>

{tokenAddress && (
  <div className="factory-token-success">
    ✅ Token created successfully!
    <div className="badges">
      <span className="badge safu">🛡️ SAFU</span>
      <span className="badge sc-pass">✓ SC Pass</span>
    </div>
    <p className="info">
      This token is automatically whitelisted and considered safe.
    </p>
  </div>
)}
```

**Validation:**

- ✅ Network selected
- ✅ Token address provided
- ✅ If existing token: ALL security checks MUST pass
- ✅ If factory token: Auto-approved

**Data Collected:**

```typescript
{
  network: string,                    // 'ethereum', 'bnb', etc.
  token_address: string,              // 0x...
  token_source: 'existing' | 'factory',
  security_scan_status: 'PASS' | 'FAIL',
  security_badges: string[],          // ['SAFU', 'SC_PASS'] or ['SC_PASS']
}
```

---

### **Step 2: Project Information** 📝

**Purpose:** Describe project and provide social links for live page

**UI Sections:**

#### 2.1 Basic Info

```typescript
<div className="space-y-4">
  {/* Project Name */}
  <div>
    <label>Project Name *</label>
    <input
      type="text"
      value={projectName}
      onChange={(e) => setProjectName(e.target.value)}
      placeholder="My Awesome Project"
      maxLength={50}
    />
    <p className="hint">This will be displayed on the fairlaunch page</p>
  </div>

  {/* Token Description */}
  <div>
    <label>Token Description *</label>
    <textarea
      value={description}
      onChange={(e) => setDescription(e.target.value)}
      placeholder="Describe your token, its utility, and what makes it unique..."
      rows={6}
      maxLength={500}
    />
    <p className="hint">{description.length}/500 characters</p>
  </div>

  {/* Logo URL */}
  <div>
    <label>Logo URL (Optional)</label>
    <input
      type="url"
      value={logoUrl}
      onChange={(e) => setLogoUrl(e.target.value)}
      placeholder="https://example.com/logo.png"
    />
    {logoUrl && (
      <div className="logo-preview">
        <img src={logoUrl} alt="Project Logo" />
      </div>
    )}
  </div>
</div>
```

#### 2.2 Social Media Links (All Optional)

```typescript
<div className="social-media-section">
  <h3>Social Media Links</h3>
  <p className="description">
    These will be displayed on your live fairlaunch page for investors to research
  </p>

  <div className="social-grid">
    {/* Website */}
    <div>
      <label>🌐 Website</label>
      <input
        type="url"
        value={social.website}
        onChange={(e) => setSocial({...social, website: e.target.value})}
        placeholder="https://yourproject.com"
      />
    </div>

    {/* Twitter/X */}
    <div>
      <label>🐦 Twitter/X</label>
      <input
        type="url"
        value={social.twitter}
        onChange={(e) => setSocial({...social, twitter: e.target.value})}
        placeholder="https://twitter.com/yourproject"
      />
    </div>

    {/* Telegram */}
    <div>
      <label>✈️ Telegram</label>
      <input
        type="url"
        value={social.telegram}
        onChange={(e) => setSocial({...social, telegram: e.target.value})}
        placeholder="https://t.me/yourproject"
      />
    </div>

    {/* Discord */}
    <div>
      <label>💬 Discord</label>
      <input
        type="url"
        value={social.discord}
        onChange={(e) => setSocial({...social, discord: e.target.value})}
        placeholder="https://discord.gg/yourproject"
      />
    </div>

    {/* Medium */}
    <div>
      <label>📄 Medium</label>
      <input
        type="url"
        value={social.medium}
        onChange={(e) => setSocial({...social, medium: e.target.value})}
        placeholder="https://medium.com/@yourproject"
      />
    </div>

    {/* GitHub */}
    <div>
      <label>💻 GitHub</label>
      <input
        type="url"
        value={social.github}
        onChange={(e) => setSocial({...social, github: e.target.value})}
        placeholder="https://github.com/yourproject"
      />
    </div>

    {/* Reddit */}
    <div>
      <label>🔴 Reddit</label>
      <input
        type="url"
        value={social.reddit}
        onChange={(e) => setSocial({...social, reddit: e.target.value})}
        placeholder="https://reddit.com/r/yourproject"
      />
    </div>

    {/* YouTube */}
    <div>
      <label>▶️ YouTube</label>
      <input
        type="url"
        value={social.youtube}
        onChange={(e) => setSocial({...social, youtube: e.target.value})}
        placeholder="https://youtube.com/@yourproject"
      />
    </div>
  </div>
</div>
```

**Validation:**

- ✅ Project name required (min 3 chars)
- ✅ Description required (min 10 chars)
- ⚠️ Logo URL optional but must be valid URL if provided
- ⚠️ All social links optional but must be valid URLs if provided

**Data Collected:**

```typescript
{
  project_name: string,               // Display name
  description: string,                // Token description
  logo_url: string | null,            // Logo image
  social_links: {
    website?: string,
    twitter?: string,
    telegram?: string,
    discord?: string,
    medium?: string,
    github?: string,
    reddit?: string,
    youtube?: string,
  }
}
```

---

### **Step 3: Sale Parameters** 💰

**Purpose:** Configure sale timing and token allocation

**UI Sections:**

#### 3.1 Token Sale Amount

```typescript
<div>
  <label>Tokens for Sale *</label>
  <input
    type="number"
    value={tokensForSale}
    onChange={(e) => setTokensForSale(e.target.value)}
    placeholder="1000000"
  />
  <p className="hint">
    Fixed amount of tokens to sell (no hardcap in fairlaunch)
  </p>
</div>
```

#### 3.2 Softcap

```typescript
<div>
  <label>Softcap (Minimum to Raise) *</label>
  <input
    type="number"
    value={softcap}
    onChange={(e) => setSoftcap(e.target.value)}
    placeholder="10"
  />
  <p className="hint">
    If softcap not met, all funds will be refunded
  </p>

  {/* Price Preview */}
  {softcap && tokensForSale && (
    <div className="price-preview">
      <p className="label">Estimated price at softcap:</p>
      <p className="value">
        1 token = {(parseFloat(softcap) / parseFloat(tokensForSale)).toFixed(8)} ETH
      </p>
      <p className="note">
        Final price = total_raised / tokens_for_sale
      </p>
    </div>
  )}
</div>
```

#### 3.3 Sale Timing

```typescript
<div className="grid grid-cols-2 gap-4">
  <div>
    <label>Start Time *</label>
    <input
      type="datetime-local"
      value={startTime}
      onChange={(e) => setStartTime(e.target.value)}
      min={new Date().toISOString().slice(0, 16)}
    />
  </div>

  <div>
    <label>End Time *</label>
    <input
      type="datetime-local"
      value={endTime}
      onChange={(e) => setEndTime(e.target.value)}
      min={startTime}
    />
  </div>
</div>

{/* Duration Display */}
{startTime && endTime && (
  <div className="duration-display">
    Sale duration: {calculateDuration(startTime, endTime)} days
  </div>
)}
```

#### 3.4 Contribution Limits

```typescript
<div className="grid grid-cols-2 gap-4">
  <div>
    <label>Min Contribution (per user) *</label>
    <input
      type="number"
      step="0.01"
      value={minContribution}
      onChange={(e) => setMinContribution(e.target.value)}
      placeholder="0.1"
    />
  </div>

  <div>
    <label>Max Contribution (per user) *</label>
    <input
      type="number"
      step="0.1"
      value={maxContribution}
      onChange={(e) => setMaxContribution(e.target.value)}
      placeholder="10"
    />
  </div>
</div>
```

#### 3.5 DEX Listing Selection

```typescript
<div>
  <label>DEX for Listing *</label>
  <select
    value={dexPlatform}
    onChange={(e) => setDexPlatform(e.target.value)}
  >
    {getAvailableDexForNetwork(network).map(dex => (
      <option key={dex.id} value={dex.id}>
        {dex.name}
      </option>
    ))}
  </select>
  <p className="hint">
    Liquidity will be added to this DEX automatically upon finalization
  </p>
</div>

{/* Network-specific options */}
// Ethereum/Sepolia: Uniswap
// BSC/BSC Testnet: PancakeSwap
// Base/Base Sepolia: BaseSwap, Uniswap
```

#### 3.6 Listing Premium (Optional)

```typescript
<div>
  <label>Listing Price Premium (%)</label>
  <input
    type="number"
    min="0"
    max="10"
    step="0.5"
    value={listingPremium}
    onChange={(e) => setListingPremium(e.target.value)}
    placeholder="0"
  />
  <p className="hint">
    Listing price on DEX = final fairlaunch price × (1 + premium%)
    <br />
    Example: 5% premium means if final price is $1, listing will be $1.05
  </p>
</div>
```

**Validation:**

- ✅ tokensForSale > 0
- ✅ softcap > 0
- ✅ startTime >= now
- ✅ endTime > startTime
- ✅ minContribution > 0
- ✅ maxContribution > minContribution
- ✅ dexPlatform selected
- ⚠️ listingPremium 0-10%

**Data Collected:**

```typescript
{
  tokens_for_sale: string,            // Amount to sell
  softcap: string,                    // Minimum to raise
  start_time: string,                 // ISO datetime
  end_time: string,                   // ISO datetime
  min_contribution: string,           // Per user min
  max_contribution: string,           // Per user max
  dex_platform: string,               // DEX ID
  listing_premium_bps: number,        // 0-1000 (0-10%)
}
```

---

### **Step 4: Liquidity Plan** 💧

**Purpose:** Configure LP allocation and lock

**UI Sections:**

#### 4.1 Liquidity Percentage

```typescript
<div>
  <label>Liquidity Percentage (%) *</label>
  <input
    type="number"
    min="70"
    max="100"
    value={liquidityPercent}
    onChange={(e) => setLiquidityPercent(e.target.value)}
  />
  <div className="slider-visual">
    <input
      type="range"
      min="70"
      max="100"
      value={liquidityPercent}
      onChange={(e) => setLiquidityPercent(e.target.value)}
    />
    <div className="markers">
      <span>70% (Min)</span>
      <span>85%</span>
      <span>100%</span>
    </div>
  </div>

  {/* Distribution Preview */}
  {softcap && tokensForSale && liquidityPercent && (
    <div className="distribution-preview">
      <h4>At Softcap ({softcap} ETH):</h4>
      <div className="breakdown">
        <div className="row">
          <span>Platform Fee (5%):</span>
          <span>{(parseFloat(softcap) * 0.05).toFixed(2)} ETH</span>
        </div>
        <div className="row">
          <span>Net Raised:</span>
          <span>{(parseFloat(softcap) * 0.95).toFixed(2)} ETH</span>
        </div>
        <div className="row highlight">
          <span>To Liquidity ({liquidityPercent}%):</span>
          <span>
            {(parseFloat(softcap) * 0.95 * liquidityPercent / 100).toFixed(2)} ETH
            <br />
            + {(parseFloat(tokensForSale) * liquidityPercent / 100).toLocaleString()} tokens
          </span>
        </div>
        <div className="row">
          <span>To Project Owner:</span>
          <span>
            {(parseFloat(softcap) * 0.95 * (100 - liquidityPercent) / 100).toFixed(2)} ETH
          </span>
        </div>
      </div>
    </div>
  )}
</div>
```

#### 4.2 LP Lock Duration

```typescript
<div>
  <label>LP Lock Duration (Months) *</label>
  <select
    value={lpLockMonths}
    onChange={(e) => setLpLockMonths(e.target.value)}
  >
    <option value="12">12 months (Min Required)</option>
    <option value="18">18 months</option>
    <option value="24">24 months (Recommended)</option>
    <option value="36">36 months</option>
    <option value="48">48 months</option>
    <option value="60">60 months (5 years)</option>
  </select>

  {/* Unlock Date Preview */}
  {lpLockMonths && endTime && (
    <div className="unlock-preview">
      <p>LP tokens will unlock on:</p>
      <p className="date">
        {calculateUnlockDate(endTime, lpLockMonths)}
      </p>
    </div>
  )}
</div>
```

**Validation:**

- ✅ liquidityPercent >= 70 && <= 100
- ✅ lpLockMonths >= 12

**Data Collected:**

```typescript
{
  liquidity_percent: number,          // 70-100
  lp_lock_months: number,             // >= 12
}
```

---

### **Step 5: Team Vesting** 📅

**Purpose:** Configure team token vesting schedule

**UI Sections:**

#### 5.1 Team Allocation

```typescript
<div>
  <label>Team Token Allocation *</label>
  <input
    type="number"
    value={teamAllocation}
    onChange={(e) => setTeamAllocation(e.target.value)}
    placeholder="1000000"
  />
  <p className="hint">
    Tokens reserved for team (separate from sale tokens)
  </p>
</div>
```

#### 5.2 Vesting Beneficiary

```typescript
<div>
  <label>Vesting Beneficiary Address *</label>
  <input
    type="text"
    value={vestingBeneficiary}
    onChange={(e) => setVestingBeneficiary(e.target.value)}
    placeholder={walletAddress}
  />
  <button onClick={() => setVestingBeneficiary(walletAddress)}>
    Use My Wallet
  </button>
  <p className="hint">
    Address that will receive vested tokens
  </p>
</div>
```

#### 5.3 Vesting Schedule Builder

```typescript
<div className="vesting-schedule">
  <label>Vesting Schedule *</label>
  <p className="description">
    Define when team tokens will unlock. Total must equal 100%.
  </p>

  {vestingPeriods.map((period, index) => (
    <div key={index} className="vesting-period">
      <div className="inputs">
        <div>
          <label>Month</label>
          <input
            type="number"
            min="0"
            value={period.month}
            onChange={(e) => updatePeriod(index, 'month', e.target.value)}
          />
        </div>
        <div>
          <label>Percentage</label>
          <input
            type="number"
            min="0"
            max="100"
            value={period.percentage}
            onChange={(e) => updatePeriod(index, 'percentage', e.target.value)}
          />
        </div>
        <div className="tokens-preview">
          {teamAllocation && (
            <span>
              = {((parseFloat(teamAllocation) * period.percentage) / 100).toLocaleString()} tokens
            </span>
          )}
        </div>
      </div>
      {vestingPeriods.length > 1 && (
        <button onClick={() => removePeriod(index)}>
          Remove
        </button>
      )}
    </div>
  ))}

  <div className="actions">
    <button onClick={addPeriod}>
      + Add Vesting Period
    </button>

    <div className={`total ${totalPercentage === 100 ? 'valid' : 'invalid'}`}>
      Total: {totalPercentage}%
      {totalPercentage === 100 ? ' ✓' : ' (must be 100%)'}
    </div>
  </div>

  {/* Common Presets */}
  <div className="presets">
    <p>Quick Presets:</p>
    <button onClick={() => applyPreset('linear-12m')}>
      Linear 12 months (monthly unlock)
    </button>
    <button onClick={() => applyPreset('cliff-6m')}>
      6m cliff then 12m linear
    </button>
    <button onClick={() => applyPreset('standard')}>
      Standard (20% TGE, 80% over 12m)
    </button>
  </div>
</div>
```

**Validation:**

- ✅ teamAllocation >= 0 (can be 0 if no team vesting)
- ✅ If teamAllocation > 0: beneficiary required
- ✅ If teamAllocation > 0: total vesting % === 100
- ✅ All vesting months >= 0

**Data Collected:**

```typescript
{
  team_allocation: string,            // Total team tokens
  vesting_beneficiary: string,        // Recipient address
  vesting_schedule: Array<{
    month: number,
    percentage: number,
  }>,
}
```

---

### **Step 6: Review & Apply** ✅

**Purpose:** Final review before deployment

**UI Sections:**

#### 6.1 Complete Summary

```typescript
<div className="review-summary">
  <h2>Review Your Fairlaunch</h2>

  {/* Token Info */}
  <section>
    <h3>Token Information</h3>
    <div className="info-grid">
      <div className="row">
        <span>Network:</span>
        <span>{network}</span>
      </div>
      <div className="row">
        <span>Token Address:</span>
        <span className="mono">{tokenAddress}</span>
      </div>
      <div className="row">
        <span>Source:</span>
        <span>
          {tokenSource === 'factory' ? 'Factory (Created)' : 'Existing (Imported)'}
        </span>
      </div>
      <div className="row">
        <span>Badges:</span>
        <span className="badges">
          {badges.map(badge => (
            <span key={badge} className={`badge ${badge.toLowerCase()}`}>
              {badge === 'SAFU' && '🛡️ SAFU'}
              {badge === 'SC_PASS' && '✓ SC Pass'}
            </span>
          ))}
        </span>
      </div>
    </div>
  </section>

  {/* Project Info */}
  <section>
    <h3>Project Information</h3>
    <div className="info-grid">
      <div className="row">
        <span>Name:</span>
        <span>{projectName}</span>
      </div>
      <div className="row">
        <span>Description:</span>
        <span>{description}</span>
      </div>
      <div className="row">
        <span>Social Links:</span>
        <span>
          {Object.entries(socialLinks)
            .filter(([_, url]) => url)
            .map(([platform, url]) => (
              <a key={platform} href={url} target="_blank">
                {platform}
              </a>
            ))
          }
        </span>
      </div>
    </div>
  </section>

  {/* Sale Parameters */}
  <section>
    <h3>Sale Parameters</h3>
    <div className="info-grid">
      <div className="row">
        <span>Tokens for Sale:</span>
        <span>{parseFloat(tokensForSale).toLocaleString()}</span>
      </div>
      <div className="row">
        <span>Softcap:</span>
        <span>{softcap} ETH</span>
      </div>
      <div className="row">
        <span>Sale Period:</span>
        <span>
          {formatDate(startTime)} - {formatDate(endTime)}
          <br />
          ({calculateDuration(startTime, endTime)} days)
        </span>
      </div>
      <div className="row">
        <span>Contribution Limits:</span>
        <span>{minContribution} - {maxContribution} ETH per user</span>
      </div>
      <div className="row">
        <span>DEX Listing:</span>
        <span>{dexPlatform}</span>
      </div>
      {listingPremium > 0 && (
        <div className="row">
          <span>Listing Premium:</span>
          <span>{listingPremium}%</span>
        </div>
      )}
    </div>
  </section>

  {/* Liquidity Plan */}
  <section>
    <h3>Liquidity Plan</h3>
    <div className="info-grid">
      <div className="row">
        <span>Liquidity %:</span>
        <span>{liquidityPercent}%</span>
      </div>
      <div className="row">
        <span>LP Lock:</span>
        <span>{lpLockMonths} months</span>
      </div>
    </div>
  </section>

  {/* Team Vesting */}
  {teamAllocation > 0 && (
    <section>
      <h3>Team Vesting</h3>
      <div className="info-grid">
        <div className="row">
          <span>Team Tokens:</span>
          <span>{parseFloat(teamAllocation).toLocaleString()}</span>
        </div>
        <div className="row">
          <span>Beneficiary:</span>
          <span className="mono">{vestingBeneficiary}</span>
        </div>
        <div className="row">
          <span>Schedule:</span>
          <span>
            {vestingSchedule.map((v, i) => (
              <div key={i}>
                Month {v.month}: {v.percentage}%
              </div>
            ))}
          </span>
        </div>
      </div>
    </section>
  )}

  {/* Fee Breakdown */}
  <section className="fee-section">
    <h3>Fees & Costs</h3>
    <div className="info-grid">
      <div className="row">
        <span>Deployment Fee:</span>
        <span className="highlight">
          {network.includes('bsc') ? '0.2 BNB' : '0.1 ETH'}
        </span>
      </div>
      <div className="row">
        <span>Platform Success Fee:</span>
        <span>5% of funds raised</span>
      </div>
    </div>
  </section>
</div>
```

#### 6.2 Terms & Conditions

```typescript
<div className="terms-section">
  <label className="checkbox-container">
    <input
      type="checkbox"
      checked={termsAccepted}
      onChange={(e) => setTermsAccepted(e.target.checked)}
    />
    <span>
      I understand and accept that:
      <ul>
        <li>Fairlaunch uses price discovery (final price = total_raised / tokens_for_sale)</li>
        <li>There is no hardcap, only softcap minimum</li>
        <li>5% platform fee will be deducted from raised funds</li>
        <li>If softcap is not met, all funds will be refunded to contributors</li>
        <li>I have reviewed all parameters and they are correct</li>
      </ul>
    </span>
  </label>
</div>
```

#### 6.3 Action Buttons

```typescript
<div className="action-buttons">
  <button
    onClick={handleSaveDraft}
    className="secondary"
  >
    Save as Draft
  </button>

  <button
    onClick={handleApply}
    disabled={!termsAccepted || !allStepsValid}
    className="primary"
  >
    Apply & Deploy →
  </button>
</div>
```

**Validation:**

- ✅ All previous steps valid
- ✅ Terms accepted

---

### **Step 7: Deploy** 🚀

**Purpose:** Auto-deploy to smart contract (NO ADMIN REVIEW)

**UI Flow:**

#### 7.1 Deployment Process

```typescript
<div className="deployment-screen">
  <h2>Deploying Your Fairlaunch</h2>

  {/* Progress Steps */}
  <div className="deployment-steps">
    {/* Step 1: Convert Data */}
    <div className={`step ${status >= 1 ? 'active' : ''} ${status > 1 ? 'complete' : ''}`}>
      <div className="icon">{status > 1 ? '✓' : '1'}</div>
      <div className ="content">
        <h3>Preparing Parameters</h3>
        <p>Converting wizard data to smart contract format...</p>
      </div>
    </div>

    {/* Step 2: Call Factory */}
    <div className={`step ${status >= 2 ? 'active' : ''} ${status > 2 ? 'complete' : ''}`}>
      <div className="icon">{status > 2 ? '✓' : '2'}</div>
      <div className="content">
        <h3>Deploying Contracts</h3>
        <p>Calling FairlaunchFactory.createFairlaunch()...</p>
        {status === 2 && (
          <div className="tx-info">
            <p>Please confirm transaction in your wallet</p>
            <p className="fee">Fee: {deploymentFee}</p>
          </div>
        )}
      </div>
    </div>

    {/* Step 3: Wait for Confirmation */}
    <div className={`step ${status >= 3 ? 'active' : ''} ${status > 3 ? 'complete' : ''}`}>
      <div className="icon">{status > 3 ? '✓' : '3'}</div>
      <div className="content">
        <h3>Waiting for Confirmation</h3>
        <p>Transaction submitted, waiting for block confirmation...</p>
        {txHash && (
          <a href={getExplorerUrl(txHash)} target="_blank">
            View on Explorer →
          </a>
        )}
      </div>
    </div>

    {/* Step 4: Save to Database */}
    <div className={`step ${status >= 4 ? 'active' : ''} ${status > 4 ? 'complete' : ''}`}>
      <div className="icon">{status > 4 ? '✓' : '4'}</div>
      <div className="content">
        <h3>Saving to Database</h3>
        <p>Storing fairlaunch details and metadata...</p>
      </div>
    </div>

    {/* Step 5: Complete */}
    <div className={`step ${status >= 5 ? 'active' : ''}`}>
      <div className="icon">🎉</div>
      <div className="content">
        <h3>Fairlaunch Created!</h3>
        <div className="success-details">
          <p>Contract Address:</p>
          <code>{fairlaunchAddress}</code>

          {vestingAddress && (
            <>
              <p>Vesting Contract:</p>
              <code>{vestingAddress}</code>
            </>
          )}

          <div className="badges">
            {badges.map(badge => (
              <span key={badge} className={`badge ${badge.toLowerCase()}`}>
                {badge}
              </span>
            ))}
          </div>

          <div className="actions">
            <button onClick={() => router.push(`/fairlaunch/${fairlaunchId}`)}>
              View Fairlaunch Page
            </button>
            <button onClick={() => router.push('/fairlaunch')}>
              Browse All Fairlaunches
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

**Backend Flow (actions.ts):**

```typescript
async function deployFairlaunch(wizardData, walletAddress) {
  // 1. Convert vesting schedule
  const vestingParams = convertVestingForSC(
    wizardData.vesting_schedule,
    wizardData.team_allocation,
    wizardData.end_time,
    wizardData.vesting_beneficiary
  );

  // 2. Convert DEX ID
  const dexId = getDexId(wizardData.dex_platform);

  // 3. Call FairlaunchFactory
  const tx = await fairlaunchFactory.createFairlaunch(
    {
      projectToken: wizardData.token_address,
      paymentToken: '0x0000000000000000000000000000000000000000', // Native
      softcap: parseEther(wizardData.softcap),
      tokensForSale: parseUnits(wizardData.tokens_for_sale, 18),
      minContribution: parseEther(wizardData.min_contribution),
      maxContribution: parseEther(wizardData.max_contribution),
      startTime: Math.floor(new Date(wizardData.start_time).getTime() / 1000),
      endTime: Math.floor(new Date(wizardData.end_time).getTime() / 1000),
      projectOwner: walletAddress,
      listingPremiumBps: wizardData.listing_premium_bps,
    },
    vestingParams,
    {
      lockMonths: wizardData.lp_lock_months,
      liquidityPercent: wizardData.liquidity_percent * 100, // Convert to BPS
      dexId: dexId,
    },
    {
      value: parseEther(deploymentFee), // 0.1 or 0.2
    }
  );

  // 4. Wait for receipt
  const receipt = await tx.wait();

  // 5. Extract addresses from events
  const event = receipt.logs.find(
    (log) => log.topics[0] === fairlaunchFactory.interface.getEventTopic('FairlaunchCreated')
  );
  const decoded = fairlaunchFactory.interface.decodeEventLog(
    'FairlaunchCreated',
    event.data,
    event.topics
  );

  // 6. Save to database
  const result = await supabase.from('fairlaunches').insert({
    contract_address: decoded.fairlaunch,
    vesting_contract: decoded.vesting || null,
    network: wizardData.network,
    project_name: wizardData.project_name,
    description: wizardData.description,
    logo_url: wizardData.logo_url,
    social_links: wizardData.social_links,
    token_address: wizardData.token_address,
    tokens_for_sale: wizardData.tokens_for_sale,
    softcap: wizardData.softcap,
    start_time: wizardData.start_time,
    end_time: wizardData.end_time,
    dex_platform: wizardData.dex_platform,
    liquidity_percent: wizardData.liquidity_percent,
    lp_lock_months: wizardData.lp_lock_months,
    status: 'UPCOMING',
    security_badges: wizardData.security_badges, // ['SAFU', 'SC_PASS'] or ['SC_PASS']
    creator_address: walletAddress,
  });

  return {
    success: true,
    fairlaunchAddress: decoded.fairlaunch,
    vestingAddress: decoded.vesting,
    fairlaunchId: result.data[0].id,
  };
}
```

---

## 🎯 Key Differences Summary

### Removed from Old Design:

- ❌ KYC requirement (Step 7)
- ❌ Admin review before deploy
- ❌ Manual badge assignment
- ❌ Delayed deployment

### Added to New Design:

- ✅ Auto SC scan on token input (Step 1)
- ✅ Comprehensive social media links (Step 2)
- ✅ Auto-deploy after wizard complete (Step 7)
- ✅ Auto-badge based on token source
- ✅ Interactive vesting schedule builder (Step 5)
- ✅ Real-time price preview (Step 3)
- ✅ Distribution breakdown (Step 4)

### Badge Logic:

```typescript
// Factory Token
badges = ['SAFU', 'SC_PASS']

// Existing Token with Scan Pass
badges = ['SC_PASS']

// Existing Token with Scan Fail
❌ Cannot proceed with wizard
```

---

## 🔒 Security & Validation

### Step 1 (Token Selection)

- If existing token: **MUST pass ALL security checks**
  - Anti-Mint ✓
  - No Honeypot ✓
  - No Tax/Fee manipulation ✓
  - No Pause function ✓
- If factory token: **Auto-whitelisted**

### No KYC Requirement

- Fairlaunch is **permissionless**
- Focus on token security, not creator identity
- Faster launch process

### Auto-Deploy

- No admin approval needed
- Instant deployment after Step 7
- Faster time-to-market

---

**Mantap kan bro? Struktur wizard lebih clean, flow lebih jelas, dan fokus ke security token bukan identity developer! 🚀**
