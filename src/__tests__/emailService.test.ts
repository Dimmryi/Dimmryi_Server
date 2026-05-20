// Mock dotenv first
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

// Mock the resend module
jest.mock('resend', () => ({
  Resend: jest.fn(() => ({
    emails: {
      send: jest.fn(),
    },
  })),
}));

// Import after mocks are set up
import { sendNotificationEmail, sendEmail, resendClient } from '../emailService';

describe('EmailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendNotificationEmail', () => {
    it('should successfully send notification email with resend', async () => {
      const mockResponse = {
        id: 'email_123',
        from: 'noreply@dimmryi.site',
        to: 'test@example.com',
        created_at: '2024-05-20T10:00:00Z',
      };

      (resendClient.emails.send as jest.Mock).mockResolvedValue(mockResponse);

      const result = await sendNotificationEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<h1>Test Email</h1>',
      });

      expect(resendClient.emails.send).toHaveBeenCalledWith({
        from: 'noreply@dimmryi.site',
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<h1>Test Email</h1>',
      });

      expect(result).toEqual(mockResponse);
    });

    it('should handle errors when sending notification email', async () => {
      const mockError = new Error('Resend API Error');
      (resendClient.emails.send as jest.Mock).mockRejectedValue(mockError);

      await expect(
        sendNotificationEmail({
          to: 'test@example.com',
          subject: 'Test Subject',
          html: '<h1>Test Email</h1>',
        })
      ).rejects.toThrow('Resend API Error');

      expect(resendClient.emails.send).toHaveBeenCalled();
    });

    it('should throw when Resend returns error object', async () => {
      (resendClient.emails.send as jest.Mock).mockResolvedValue({
        error: { message: 'domain not verified', name: 'validation_error' },
      });

      await expect(
        sendNotificationEmail({
          to: 'test@example.com',
          subject: 'Test Subject',
          html: '<h1>Test Email</h1>',
        })
      ).rejects.toThrow('domain not verified');
    });

    it('should send email with correct parameters', async () => {
      (resendClient.emails.send as jest.Mock).mockResolvedValue({ id: 'email_456' });

      await sendNotificationEmail({
        to: 'user@example.com',
        subject: 'Welcome!',
        html: '<p>Welcome to our app</p>',
      });

      const callArgs = (resendClient.emails.send as jest.Mock).mock.calls[0][0];
      expect(callArgs.to).toBe('user@example.com');
      expect(callArgs.subject).toBe('Welcome!');
      expect(callArgs.html).toContain('Welcome to our app');
    });
  });

  describe('sendEmail', () => {
    it('should successfully send email via Resend', async () => {
      (resendClient.emails.send as jest.Mock).mockResolvedValue({ id: 'email_789' });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await sendEmail('recipient@example.com', 'Test Subject', 'Test email content');

      expect(resendClient.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'recipient@example.com',
          subject: 'Test Subject',
          html: '<p>Test email content</p>',
        })
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Email sent to recipient@example.com')
      );

      consoleSpy.mockRestore();
    });

    it('should handle errors when sending email', async () => {
      const mockError = new Error('Resend connection failed');
      (resendClient.emails.send as jest.Mock).mockRejectedValue(mockError);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      jest.spyOn(console, 'log').mockImplementation();

      await expect(
        sendEmail('recipient@example.com', 'Test Subject', 'Test content')
      ).rejects.toThrow('Resend connection failed');

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should call resendClient.emails.send with correct parameters', async () => {
      (resendClient.emails.send as jest.Mock).mockResolvedValue({});
      jest.spyOn(console, 'log').mockImplementation();

      await sendEmail('admin@test.com', 'Notification', 'Important message');

      const callArgs = (resendClient.emails.send as jest.Mock).mock.calls[0][0];
      expect(callArgs.to).toBe('admin@test.com');
      expect(callArgs.subject).toBe('Notification');
      expect(callArgs.html).toBe('<p>Important message</p>');

      jest.restoreAllMocks();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle multiple emails in sequence', async () => {
      (resendClient.emails.send as jest.Mock).mockResolvedValue({ id: 'email_1' });
      jest.spyOn(console, 'log').mockImplementation();

      const email1 = sendNotificationEmail({
        to: 'user1@example.com',
        subject: 'Email 1',
        html: '<p>Email 1</p>',
      });

      const email2 = sendEmail('user2@example.com', 'Email 2', 'Content 2');

      await Promise.all([email1, email2]);

      expect(resendClient.emails.send).toHaveBeenCalledTimes(2);

      jest.restoreAllMocks();
    });

    it('should handle partial failures gracefully', async () => {
      (resendClient.emails.send as jest.Mock)
        .mockRejectedValueOnce(new Error('Resend failed'))
        .mockResolvedValueOnce({ id: 'email_ok' });

      jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(console, 'error').mockImplementation();

      const resendPromise = sendNotificationEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      }).catch(e => e);

      const secondPromise = sendEmail('user@example.com', 'Test', 'Test');

      const [resendResult] = await Promise.all([resendPromise, secondPromise]);

      expect(resendResult).toBeInstanceOf(Error);
      expect(resendClient.emails.send).toHaveBeenCalledTimes(2);

      jest.restoreAllMocks();
    });
  });
});
