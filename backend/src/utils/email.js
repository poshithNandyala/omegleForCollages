import { Resend } from "resend"
import crypto from "crypto"

const resend = new Resend(process.env.RESEND_API_KEY)

const generateOTP = () => {
    return crypto.randomInt(100000, 999999).toString()
}

const sendOTPEmail = async (email, otp) => {
    const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM || "CampusConnect <onboarding@resend.dev>",
        to: [email],
        subject: "CampusConnect - Verify Your College Email",
        html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
                <div style="background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 32px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">CampusConnect</h1>
                    <p style="color: #c4b5fd; margin: 8px 0 0; font-size: 14px;">Meet your campus, anonymously</p>
                </div>
                <div style="padding: 32px;">
                    <h2 style="color: #1f2937; margin: 0 0 8px; font-size: 20px;">Verify Your Email</h2>
                    <p style="color: #6b7280; margin: 0 0 24px; font-size: 14px; line-height: 1.5;">
                        Use the code below to verify your college email. Don't share this with anyone.
                    </p>
                    <div style="background: #f5f3ff; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                        <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #4f46e5;">${otp}</span>
                    </div>
                    <p style="color: #9ca3af; margin: 0; font-size: 13px; text-align: center;">
                        Expires in <strong>10 minutes</strong>
                    </p>
                </div>
                <div style="background: #faf5ff; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                        &copy; ${new Date().getFullYear()} CampusConnect. Didn't request this? Ignore this email.
                    </p>
                </div>
            </div>
        `
    })

    if (error) throw new Error(error.message)
    return data
}

export { generateOTP, sendOTPEmail }
