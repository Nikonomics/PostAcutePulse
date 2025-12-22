const axios = require("axios");

const SENDER_CONFIG = {
    name: "SNFalyze",
    email: process.env.SENDER_EMAIL || "noreply@snfalyze.com"
};

module.exports = {
    sendBrevoEmail: async (data) => {
        try {
            const emailData = {
                sender: {
                    name: data.sender_name || SENDER_CONFIG.name,
                    email: data.sender_email || SENDER_CONFIG.email,
                },
                to: [
                    {
                        email: data.receiver_email,
                        name: data.receiver_name,
                    },
                ],
                subject: data.subject,
                htmlContent: data.htmlContent,
            };

            const response = await axios.post(
                process.env.BREVO_EMAIL_URL,
                emailData,
                {
                    headers: {
                        accept: "application/json",
                        "Content-Type": "application/json",
                        "api-key": process.env.BREVO_API_KEY,
                    },
                }
            );

            console.log("Email sent=======:", response.data);
            return { STATUS_CODE: 200, data: response.data };
        } catch (error) {
            console.error(
                "Failed to send email:",
                error.response?.data || error.message
            );
            return {
                STATUS_CODE: 500,
                data: error.message || error.response?.data,
            };
        }
    },

    sendInvitationEmail: async (data) => {
        const { invitee_email, inviter_name, role, invite_link } = data;

        const roleDisplayNames = {
            'admin': 'Administrator',
            'deal_manager': 'Deal Manager',
            'analyst': 'Analyst',
            'viewer': 'Viewer'
        };

        const roleDisplay = roleDisplayNames[role] || role;

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited to SNFalyze</h1>
                </div>

                <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
                    <p style="font-size: 16px; margin-top: 0;">
                        <strong>${inviter_name}</strong> has invited you to join SNFalyze as a <strong>${roleDisplay}</strong>.
                    </p>

                    <p style="font-size: 14px; color: #6b7280;">
                        SNFalyze is a platform for skilled nursing facility analytics, M&A deal management, and market intelligence.
                    </p>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${invite_link}"
                           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                            Accept Invitation
                        </a>
                    </div>

                    <p style="font-size: 13px; color: #9ca3af; margin-bottom: 0;">
                        This invitation will expire in 7 days. If you did not expect this invitation, you can safely ignore this email.
                    </p>
                </div>

                <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
                    <p style="margin: 0;">SNFalyze - Skilled Nursing Facility Intelligence Platform</p>
                </div>
            </body>
            </html>
        `;

        return module.exports.sendBrevoEmail({
            receiver_email: invitee_email,
            receiver_name: invitee_email,
            subject: `${inviter_name} has invited you to SNFalyze`,
            htmlContent
        });
    }
}