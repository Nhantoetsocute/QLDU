const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true cho port 465, false cho port 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

exports.sendOTP = async (toEmail, otpCode) => {
  try {
    const mailOptions = {
      from: `"QuanLyBanNuoc System" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: 'Mã xác thực khôi phục mật khẩu',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #D4AF37; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
          <div style="background-color: #0A0A0A; padding: 20px; text-align: center; border-bottom: 3px solid #D4AF37;">
            <h2 style="color: #D4AF37; margin: 0; font-size: 24px; letter-spacing: 2px;">TRUE JUICE</h2>
          </div>
          <div style="background-color: #ffffff; padding: 30px; color: #333333;">
            <h3 style="color: #1A1A1A; margin-top: 0; font-size: 20px;">Yêu cầu khôi phục mật khẩu</h3>
            <p style="font-size: 16px; line-height: 1.5; margin-bottom: 25px;">
              Xin chào,<br>
              Chúng tôi nhận được yêu cầu khôi phục mật khẩu cho tài khoản liên kết với email này. Vui lòng sử dụng mã xác thực (OTP) dưới đây để hoàn tất quá trình:
            </p>
            
            <div style="background-color: rgba(212, 175, 55, 0.1); border: 1px dashed #D4AF37; border-radius: 8px; padding: 15px; text-align: center; margin-bottom: 25px;">
              <span style="font-size: 32px; font-weight: bold; color: #D4AF37; letter-spacing: 5px;">${otpCode}</span>
            </div>
            
            <p style="font-size: 14px; color: #666666; line-height: 1.5;">
              Mã xác thực này có hiệu lực trong vòng <strong>10 phút</strong>. Vì lý do bảo mật, vui lòng không chia sẻ mã này cho bất kỳ ai.
            </p>
            <p style="font-size: 14px; color: #666666; line-height: 1.5;">
              Nếu bạn không yêu cầu thao tác này, bạn có thể bỏ qua email này. Tài khoản của bạn vẫn được bảo mật an toàn.
            </p>
          </div>
          <div style="background-color: #f8f8f8; padding: 15px; text-align: center; border-top: 1px solid #eeeeee;">
            <p style="font-size: 12px; color: #999999; margin: 0;">&copy; 2026 True Juice. All rights reserved.</p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};
