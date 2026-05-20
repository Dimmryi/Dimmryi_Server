import { sendNotificationEmail, sendEmail } from '../emailService';

// Mock the resend module
jest.mock('resend', () => ({
  Resend: jest.fn(() => ({
    emails: {
      send: jest.fn(),
    },
  })),
}));

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn(),
  })),
}));

// Mock dotenv
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

describe('EmailService', () => {
  let mockResend: any;
  let mockNodemailer: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocks
    const Resend = require('resend').Resend;
    mockResend = Resend().emails.send;
    
    const nodemailer = require('nodemailer');
    mockNodemailer = nodemailer.createTransport().sendMail;
  });

  describe('sendNotificationEmail', () => {
    it('should successfully send notification email with resend', async () => {
      const mockResponse = {
        id: 'email_123',
        from: 'noreply@dimmryi.site',
        to: 'test@example.com',
        created_at: '2024-05-20T10:00:00Z',
      };

      mockResend.mockResolvedValue(mockResponse);

      const result = await sendNotificationEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<h1>Test Email</h1>',
      });

      expect(mockResend).toHaveBeenCalledWith({
        from: 'noreply@dimmryi.site',
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<h1>Test Email</h1>',
      });

      expect(result).toEqual(mockResponse);
    });

    it('should handle errors when sending notification email', async () => {
      const mockError = new Error('Resend API Error');
      mockResend.mockRejectedValue(mockError);

      await expect(
        sendNotificationEmail({
          to: 'test@example.com',
          subject: 'Test Subject',
          html: '<h1>Test Email</h1>',
        })
      ).rejects.toThrow('Resend API Error');

      expect(mockResend).toHaveBeenCalled();
    });

    it('should send email with correct parameters', async () => {
      mockResend.mockResolvedValue({ id: 'email_456' });

      await sendNotificationEmail({
        to: 'user@example.com',
        subject: 'Welcome!',
        html: '<p>Welcome to our app</p>',
      });

      const callArgs = mockResend.mock.calls[0][0];
      expect(callArgs.to).toBe('user@example.com');
      expect(callArgs.subject).toBe('Welcome!');
      expect(callArgs.html).toContain('Welcome to our app');
    });
  });

  describe('sendEmail', () => {
    it('should successfully send email via nodemailer', async () => {
      mockNodemailer.mockResolvedValue({ response: '250 OK' });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await sendEmail('recipient@example.com', 'Test Subject', 'Test email content');

      expect(mockNodemailer).toHaveBeenCalledWith({
        from: '"Real Estate App" <your_email@gmail.com>',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Test email content',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Email sent to recipient@example.com')
      );

      consoleSpy.mockRestore();
    });

    it('should handle errors when sending email via nodemailer', async () => {
      const mockError = new Error('SMTP connection failed');
      mockNodemailer.mockRejectedValue(mockError);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await sendEmail('recipient@example.com', 'Test Subject', 'Test content');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to send email:',
        mockError
      );

      consoleErrorSpy.mockRestore();
    });

    it('should call transporter.sendMail with correct parameters', async () => {
      mockNodemailer.mockResolvedValue({});

      jest.spyOn(console, 'log').mockImplementation();

      await sendEmail('admin@test.com', 'Notification', 'Important message');

      const callArgs = mockNodemailer.mock.calls[0][0];
      expect(callArgs.to).toBe('admin@test.com');
      expect(callArgs.subject).toBe('Notification');
      expect(callArgs.text).toBe('Important message');

      jest.restoreAllMocks();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle multiple emails in sequence', async () => {
      mockResend.mockResolvedValue({ id: 'email_1' });
      jest.spyOn(console, 'log').mockImplementation();

      const email1 = sendNotificationEmail({
        to: 'user1@example.com',
        subject: 'Email 1',
        html: '<p>Email 1</p>',
      });

      mockNodemailer.mockResolvedValue({});
      const email2 = sendEmail('user2@example.com', 'Email 2', 'Content 2');

      const results = await Promise.all([email1, email2]);

      expect(mockResend).toHaveBeenCalled();
      expect(mockNodemailer).toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('should handle partial failures gracefully', async () => {
      mockResend.mockRejectedValue(new Error('Resend failed'));
      mockNodemailer.mockResolvedValue({});
      jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(console, 'error').mockImplementation();

      const resendPromise = sendNotificationEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      }).catch(e => e);

      const nodemailerPromise = sendEmail('user@example.com', 'Test', 'Test');

      const [resendResult, nodemailerResult] = await Promise.all([
        resendPromise,
        nodemailerPromise,
      ]);

      expect(resendResult).toBeInstanceOf(Error);
      expect(mockNodemailer).toHaveBeenCalled();

      jest.restoreAllMocks();
    });
  });
});
