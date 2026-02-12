const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Checking Project "cur" ---');
  const project = await prisma.projects.findFirst({
    where: { name: { contains: 'cur', mode: 'insensitive' } },
  });

  if (!project) {
    console.log('Project "cur" not found in DB');
    return;
  }

  console.log(`Project ID: ${project.id}`);
  console.log(`Name: ${project.name}`);
  console.log(`Contract: ${project.contract_address}`);
  console.log(`Chain ID: ${project.chain_id}`);

  console.log('\n--- Checking Contributions ---');
  const txHashes = [
    '0xe34056b791606eee1195079221ba5a4a6c17a5858091e6d8b4c5839bbcf3ed3d',
    '0x9e773ef9e87ebf8e624d5d26ebd25bc13c8ee28c3ee8311616194c05e9e0e222',
  ];

  const contributions = await prisma.contributions.findMany({
    where: {
      transaction_hash: { in: txHashes },
    },
  });

  contributions.forEach((c) => {
    console.log(`\nTX: ${c.transaction_hash}`);
    console.log(`User: ${c.user_wallet_address}`);
    console.log(`Amount: ${c.amount}`);
    console.log(`Referral Code Used: ${c.referral_code_used || 'NONE'}`);
  });

  console.log('\n--- Checking Referral Rewards ---');
  // Check if any rewards were generated for these contributions
  // Note: Schema might use 'referral_rewards' or similar.
  // Let's check 'referral_rewards' table if exists, or just inferred from contributions
  try {
    const rewards = await prisma.referral_rewards.findMany({
      where: {
        contribution_id: { in: contributions.map((c) => c.id) },
      },
    });
    if (rewards.length === 0)
      console.log('No referral_rewards records found for these contributions.');
    rewards.forEach((r) => {
      console.log(`Reward for Contribution ${r.contribution_id}:`);
      console.log(`  referrer: ${r.referrer_wallet_address}`);
      console.log(`  amount: ${r.reward_amount}`);
      console.log(`  status: ${r.status}`);
    });
  } catch (e) {
    console.log(
      'Error querying referral_rewards (table might not exist or verify schema):',
      e.message
    );
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
