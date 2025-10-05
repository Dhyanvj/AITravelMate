import CryptoJS from 'crypto-js';
import 'react-native-get-random-values';

class EncryptionService {
  constructor() {
    // Generate a key per trip or use a master key
    this.masterKey = 'AITravelMate2024SecureKey'; // In production, generate dynamically
  }

  // Generate encryption key for a trip
  generateTripKey(tripId) {
    try {
      return CryptoJS.SHA256(tripId + this.masterKey).toString();
    } catch (error) {
      console.warn('CryptoJS SHA256 failed, using fallback:', error);
      // Fallback to a simple hash if CryptoJS fails
      return this.simpleHash(tripId + this.masterKey);
    }
  }

  // Simple hash fallback
  simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
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
      console.warn('Encryption failed, storing as plain text:', error);
      return {
        encrypted: false,
        content: message
      };
    }
  }

  // Decrypt message
  decryptMessage(encryptedMessage, tripId) {
    try {
      // If not encrypted, return as is
      if (!encryptedMessage || typeof encryptedMessage !== 'string') {
        return encryptedMessage;
      }
      
      const key = this.generateTripKey(tripId);
      const decrypted = CryptoJS.AES.decrypt(encryptedMessage, key);
      const result = decrypted.toString(CryptoJS.enc.Utf8);
      
      // If decryption failed, return original message
      if (!result) {
        return encryptedMessage;
      }
      
      return result;
    } catch (error) {
      console.warn('Decryption failed, returning original message:', error);
      return encryptedMessage;
    }
  }

  // Hash sensitive data
  hashData(data) {
    try {
      return CryptoJS.SHA256(data).toString();
    } catch (error) {
      console.warn('CryptoJS hash failed, using fallback:', error);
      return this.simpleHash(data);
    }
  }
}

export default new EncryptionService();