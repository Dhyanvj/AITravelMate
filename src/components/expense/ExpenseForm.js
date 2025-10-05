import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Button, Card, Icon, Input } from 'react-native-elements';
import expenseService from '../../services/expenseService';

export default function ExpenseForm({
  formData,
  setFormData,
  members,
  currentUser,
  onSave,
  loading
}) {
  const [splitType, setSplitType] = useState('equal'); // 'equal' or 'custom'
  const [showParticipantPicker, setShowParticipantPicker] = useState(false);
  const [showCustomSplits, setShowCustomSplits] = useState(false);

  const categories = expenseService.getCategories();

  useEffect(() => {
    if (formData.participants.length > 0 && splitType === 'equal') {
      calculateEqualSplits();
    }
  }, [formData.amount, formData.participants, splitType]);

  const calculateEqualSplits = () => {
    if (!formData.amount || formData.participants.length === 0) return;
    
    const splits = expenseService.calculateEqualSplits(
      parseFloat(formData.amount),
      formData.participants
    );
    
    setFormData(prev => ({
      ...prev,
      customSplits: splits
    }));
  };

  const handleParticipantToggle = (userId) => {
    setFormData(prev => ({
      ...prev,
      participants: prev.participants.includes(userId)
        ? prev.participants.filter(id => id !== userId)
        : [...prev.participants, userId]
    }));
  };

  const handleCustomSplitChange = (userId, amount) => {
    setFormData(prev => ({
      ...prev,
      customSplits: prev.customSplits.map(split =>
        split.userId === userId ? { ...split, amount: parseFloat(amount) || 0 } : split
      )
    }));
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter an expense title');
      return false;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return false;
    }
    if (!formData.paidBy) {
      Alert.alert('Error', 'Please select who paid for this expense');
      return false;
    }
    if (!formData.isPersonal && formData.participants.length === 0) {
      Alert.alert('Error', 'Please select at least one participant for shared expenses');
      return false;
    }
    if (!formData.isPersonal && splitType === 'custom') {
      const totalCustomAmount = formData.customSplits.reduce((sum, split) => sum + split.amount, 0);
      const totalAmount = parseFloat(formData.amount);
      if (Math.abs(totalCustomAmount - totalAmount) > 0.01) {
        Alert.alert('Error', 'Custom split amounts must equal the total expense amount');
        return false;
      }
    }
    return true;
  };

  const handleSave = () => {
    if (validateForm()) {
      onSave();
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Basic Information */}
      <Card containerStyle={styles.card}>
        <Text style={styles.sectionTitle}>Basic Information</Text>
        
        <Input
          label="Expense Title *"
          placeholder="Enter expense title"
          value={formData.title}
          onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
          containerStyle={styles.inputContainer}
        />

        <Input
          label="Amount *"
          placeholder="0.00"
          value={formData.amount}
          onChangeText={(text) => {
            // Allow only numbers and one decimal point
            const filteredText = text.replace(/[^0-9.]/g, '');
            const parts = filteredText.split('.');
            const cleanText = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : filteredText;
            setFormData(prev => ({ ...prev, amount: cleanText }));
          }}
          keyboardType="decimal-pad"
          containerStyle={styles.inputContainer}
          leftIcon={<Icon name="attach-money" type="material" size={20} color="#8E8E93" />}
        />

        <View style={styles.categoryContainer}>
          <Text style={styles.label}>Category *</Text>
          <View style={styles.categoryGrid}>
            {categories.map(category => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryItem,
                  formData.category === category.id && styles.selectedCategory
                ]}
                onPress={() => setFormData(prev => ({ ...prev, category: category.id }))}
              >
                <View style={[styles.categoryIcon, { backgroundColor: category.color }]}>
                  <Icon name={category.icon} type="material" color="white" size={20} />
                </View>
                <Text style={[
                  styles.categoryText,
                  formData.category === category.id && styles.selectedCategoryText
                ]}>
                  {category.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Input
          label="Description"
          placeholder="Optional description"
          value={formData.description}
          onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
          multiline
          numberOfLines={3}
          containerStyle={styles.inputContainer}
        />
      </Card>

      {/* Expense Type */}
      <Card containerStyle={styles.card}>
        <Text style={styles.sectionTitle}>Expense Type</Text>
        
        <View style={styles.switchContainer}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Personal Expense</Text>
            <Text style={styles.switchDescription}>
              {formData.isPersonal 
                ? 'This expense is only for your personal tracking' 
                : 'This expense will be shared with selected participants'
              }
            </Text>
          </View>
          <Switch
            value={formData.isPersonal}
            onValueChange={(value) => setFormData(prev => ({ ...prev, isPersonal: value }))}
            trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
            thumbColor={formData.isPersonal ? '#FFFFFF' : '#FFFFFF'}
          />
        </View>
      </Card>

      {/* Paid By */}
      <Card containerStyle={styles.card}>
        <Text style={styles.sectionTitle}>Paid By *</Text>
        
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={formData.paidBy}
            onValueChange={(value) => setFormData(prev => ({ ...prev, paidBy: value }))}
            style={styles.picker}
          >
            <Picker.Item label="Select who paid" value="" />
            {members.map(member => (
              <Picker.Item
                key={member.user_id}
                label={member.profiles?.full_name || member.profiles?.username}
                value={member.user_id}
              />
            ))}
          </Picker>
        </View>
      </Card>

      {/* Participants (for shared expenses) */}
      {!formData.isPersonal && (
        <Card containerStyle={styles.card}>
          <Text style={styles.sectionTitle}>Participants *</Text>
          
          <TouchableOpacity
            style={styles.participantButton}
            onPress={() => setShowParticipantPicker(!showParticipantPicker)}
          >
            <Text style={styles.participantButtonText}>
              {formData.participants.length} participant(s) selected
            </Text>
            <Icon 
              name={showParticipantPicker ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
              type="material" 
              size={24} 
              color="#007AFF" 
            />
          </TouchableOpacity>

          {showParticipantPicker && (
            <View style={styles.participantList}>
              {members.map(member => (
                <TouchableOpacity
                  key={member.user_id}
                  style={styles.participantItem}
                  onPress={() => handleParticipantToggle(member.user_id)}
                >
                  <View style={styles.participantInfo}>
                    <Text style={styles.participantName}>
                      {member.profiles?.full_name || member.profiles?.username}
                    </Text>
                  </View>
                  <View style={[
                    styles.checkbox,
                    formData.participants.includes(member.user_id) && styles.checkedBox
                  ]}>
                    {formData.participants.includes(member.user_id) && (
                      <Icon name="check" type="material" size={16} color="white" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card>
      )}

      {/* Split Options (for shared expenses) */}
      {!formData.isPersonal && formData.participants.length > 0 && (
        <Card containerStyle={styles.card}>
          <Text style={styles.sectionTitle}>Split Options</Text>
          
          <View style={styles.splitTypeContainer}>
            <TouchableOpacity
              style={[
                styles.splitTypeButton,
                splitType === 'equal' && styles.selectedSplitType
              ]}
              onPress={() => setSplitType('equal')}
            >
              <Text style={[
                styles.splitTypeText,
                splitType === 'equal' && styles.selectedSplitTypeText
              ]}>
                Equal Split
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.splitTypeButton,
                splitType === 'custom' && styles.selectedSplitType
              ]}
              onPress={() => setSplitType('custom')}
            >
              <Text style={[
                styles.splitTypeText,
                splitType === 'custom' && styles.selectedSplitTypeText
              ]}>
                Custom Split
              </Text>
            </TouchableOpacity>
          </View>

          {splitType === 'custom' && (
            <View style={styles.customSplitsContainer}>
              <Text style={styles.customSplitsTitle}>Custom Amounts</Text>
              {formData.customSplits.map((split, index) => {
                const member = members.find(m => m.user_id === split.userId);
                return (
                  <View key={index} style={styles.customSplitItem}>
                    <Text style={styles.customSplitName}>
                      {member?.profiles?.full_name || member?.profiles?.username}
                    </Text>
                    <Input
                      placeholder="0.00"
                      value={split.amount === 0 ? '' : split.amount.toString()}
                      onChangeText={(text) => {
                        // Allow only numbers and one decimal point
                        const filteredText = text.replace(/[^0-9.]/g, '');
                        const parts = filteredText.split('.');
                        const cleanText = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : filteredText;
                        handleCustomSplitChange(split.userId, cleanText);
                      }}
                      keyboardType="decimal-pad"
                      containerStyle={styles.customSplitInput}
                      inputStyle={styles.customSplitInputText}
                    />
                  </View>
                );
              })}
              <Text style={styles.totalText}>
                Total: ${formData.customSplits.reduce((sum, split) => sum + split.amount, 0).toFixed(2)}
              </Text>
            </View>
          )}

          {splitType === 'equal' && formData.customSplits.length > 0 && (
            <View style={styles.equalSplitsContainer}>
              <Text style={styles.equalSplitsTitle}>Equal Split Preview</Text>
              {formData.customSplits.map((split, index) => {
                const member = members.find(m => m.user_id === split.userId);
                return (
                  <View key={index} style={styles.equalSplitItem}>
                    <Text style={styles.equalSplitName}>
                      {member?.profiles?.full_name || member?.profiles?.username}
                    </Text>
                    <Text style={styles.equalSplitAmount}>
                      ${split.amount.toFixed(2)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </Card>
      )}

      {/* Save Button */}
      <View style={styles.saveButtonContainer}>
        <Button
          title={loading ? 'Saving...' : 'Save Expense'}
          buttonStyle={styles.saveButton}
          onPress={handleSave}
          disabled={loading}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  categoryContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryItem: {
    width: '30%',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 12,
  },
  selectedCategory: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  selectedCategoryText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  picker: {
    height: 52.5,
  },
  participantButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  participantButtonText: {
    fontSize: 16,
    color: '#000',
  },
  participantList: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  participantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    color: '#000',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedBox: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  splitTypeContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  splitTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
  },
  selectedSplitType: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  splitTypeText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  selectedSplitTypeText: {
    color: 'white',
    fontWeight: '600',
  },
  customSplitsContainer: {
    marginTop: 16,
  },
  customSplitsTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 12,
  },
  customSplitItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  customSplitName: {
    fontSize: 16,
    color: '#000',
    flex: 1,
  },
  customSplitInput: {
    width: 100,
    marginBottom: 0,
  },
  customSplitInputText: {
    textAlign: 'right',
  },
  totalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    textAlign: 'right',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  equalSplitsContainer: {
    marginTop: 16,
  },
  equalSplitsTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 12,
  },
  equalSplitItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  equalSplitName: {
    fontSize: 16,
    color: '#000',
  },
  equalSplitAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  saveButtonContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 16,
  },
  
});
