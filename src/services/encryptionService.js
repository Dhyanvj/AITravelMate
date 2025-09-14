import CryptoJS from 'crypto-js';

class EncryptionService {
  constructor() {
    // Generate a key per trip or use a master key
    this.masterKey = 'AITravelMate2024SecureKey'; // In production, generate dynamically
  }

  // Generate encryption key for a trip
  generateTripKey(tripId) {
    return CryptoJS.SHA256(tripId + this.masterKey).toString();
  }

  // Encrypt message
  encryptMessage(message, tripId) {
    try {
      const key = this.generateTripKey(tripId);
      const encrypted = CryptoJS.AES.encrypt(message, key).toString();
      return {
        encrypted: true,
        content: encrypted
      };
    } catch (error) {
      console.error('Encryption error:', error);
      return {
        encrypted: false,
        content: message
      };
    }
  }

  // Decrypt message
  decryptMessage(encryptedMessage, tripId) {
    try {
      const key = this.generateTripKey(tripId);
      const decrypted = CryptoJS.AES.decrypt(encryptedMessage, key);
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Decryption error:', error);
      return encryptedMessage;
    }
  }

  // Hash sensitive data
  hashData(data) {
    return CryptoJS.SHA256(data).toString();
  }
}

export default new EncryptionService();