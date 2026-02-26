import { generateChangeSummaries } from './server/generate-change-summary.ts';
import { sendSyncReport } from './server/send-sync-report.ts';

console.log('🧪 Testing Email Report Generation...\n');

// Mock sync results
const mockResults = {
  devices: {
    success: true,
    message: 'Synced successfully',
    timestamp: new Date(),
    itemsUpdated: 66,
    duration: 5420
  },
  software: {
    success: true,
    message: 'Synced successfully',
    timestamp: new Date(),
    itemsUpdated: 45,
    duration: 4200
  },
  systems: {
    success: true,
    message: 'Synced successfully',
    timestamp: new Date(),
    itemsUpdated: 32,
    duration: 3800
  },
  hearing: {
    success: true,
    message: 'Synced successfully',
    timestamp: new Date(),
    itemsUpdated: 28,
    duration: 3500
  },
  ai: {
    success: true,
    message: 'Synced successfully',
    timestamp: new Date(),
    itemsUpdated: 19,
    duration: 3200
  },
  decisions: {
    success: true,
    message: 'Synced successfully',
    timestamp: new Date(),
    itemsUpdated: 15,
    duration: 2900
  },
  milestones: {
    success: true,
    message: 'Synced successfully',
    timestamp: new Date(),
    itemsUpdated: 24,
    duration: 2600
  },
  upcomingReviews: {
    success: true,
    message: 'Synced successfully',
    timestamp: new Date(),
    itemsUpdated: 8,
    duration: 2100
  }
};

try {
  console.log('📧 Generating email report with AI summaries...\n');
  await sendSyncReport(mockResults);
  console.log('\n✅ Email report generated successfully!');
  console.log('\n📝 The report above shows what will be sent to tlowe999@meta.com');
  console.log('   after each sync at 8:45 AM PST.');
} catch (error) {
  console.error('\n❌ Error generating email report:', error);
  process.exit(1);
}
