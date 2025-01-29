const nodemailer = require('nodemailer');
require('dotenv').config();

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m'
};

// Test wallet data
const testWallet = {
    address: '0x0000000000000000000000000000000000000000',
    privateKey: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
};

// Email configuration
const emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_PORT === '465',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Check required environment variables
function checkEnvironmentVariables() {
    const required = [
        'SMTP_HOST',
        'SMTP_PORT',
        'SMTP_USER',
        'SMTP_PASS',
        'NOTIFICATION_EMAIL'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error(`${colors.red}Error: Missing environment variables:${colors.reset}`);
        missing.forEach(key => {
            console.error(`- ${key}`);
        });
        console.log('\nPlease check your .env file and ensure all required variables are set.');
        process.exit(1);
    }
}

// Send test email
async function sendTestEmail() {
    try {
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.SMTP_USER}>`,
            to: process.env.NOTIFICATION_EMAIL,
            subject: 'Wallet Scout - Email Test',
            html: `
                <h2>Email Configuration Test</h2>
                <p>This is a test email from Wallet Scout to verify your email configuration.</p>
                <h3>Test Wallet Information:</h3>
                <ul>
                    <li><strong>Chain:</strong> TEST-CHAIN</li>
                    <li><strong>Address:</strong> ${testWallet.address}</li>
                    <li><strong>Private Key:</strong> ${testWallet.privateKey}</li>
                    <li><strong>Test Time:</strong> ${new Date().toLocaleString()}</li>
                </ul>
                <p>If you received this email, your email configuration is working correctly!</p>
            `
        };

        const info = await emailTransporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        throw error;
    }
}

// Main test function
async function runTests() {
    console.log(`${colors.bright}Starting email configuration test...${colors.reset}\n`);

    // Check environment variables
    try {
        checkEnvironmentVariables();
        console.log(`${colors.green}✓ Environment variables check passed${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}✗ Environment variables check failed${colors.reset}`);
        process.exit(1);
    }

    // Verify SMTP configuration
    try {
        console.log('\nVerifying SMTP configuration...');
        await emailTransporter.verify();
        console.log(`${colors.green}✓ SMTP configuration verified successfully${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}✗ SMTP configuration error:${colors.reset}`, error.message);
        process.exit(1);
    }

    // Send test email
    try {
        console.log('\nSending test email...');
        const info = await sendTestEmail();
        console.log(`${colors.green}✓ Test email sent successfully${colors.reset}`);
        console.log(`Message ID: ${info.messageId}`);
    } catch (error) {
        console.error(`${colors.red}✗ Failed to send test email:${colors.reset}`, error.message);
        process.exit(1);
    }

    // Summary
    console.log(`\n${colors.bright}Test Summary:${colors.reset}`);
    console.log(`SMTP Host: ${process.env.SMTP_HOST}`);
    console.log(`SMTP Port: ${process.env.SMTP_PORT}`);
    console.log(`From: ${process.env.SMTP_USER}`);
    console.log(`To: ${process.env.NOTIFICATION_EMAIL}`);
    
    console.log(`\n${colors.green}All tests completed successfully!${colors.reset}`);
    console.log(`${colors.yellow}Note: Please check ${process.env.NOTIFICATION_EMAIL} to confirm the test email was received.${colors.reset}`);
}

// Run tests
console.log(`${colors.bright}Email Notification Test Suite${colors.reset}\n`);
runTests().catch(error => {
    console.error(`${colors.red}Unexpected error:${colors.reset}`, error);
    process.exit(1);
});