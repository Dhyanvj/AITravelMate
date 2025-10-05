import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Button, Icon } from 'react-native-elements';
import packingService from '../../services/packingService';

export default function PackingItemForm({
  formData,
  setFormData,
  members,
  currentUser,
  onSave,
  loading
}) {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const categoriesData = await packingService.getPackingCategories();
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories(packingService.getDefaultCategories());
    }
  };

  const handleSave = () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter an item title');
      return;
    }

    onSave();
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.formGroup}>
        <Text style={styles.label}>Item Title *</Text>
        <TextInput
          style={styles.input}
          value={formData.title}
          onChangeText={(text) => setFormData({ ...formData, title: text })}
          placeholder="e.g., Passport, Toothbrush, Camera"
          maxLength={255}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.description}
          onChangeText={(text) => setFormData({ ...formData, description: text })}
          placeholder="Optional description or notes"
          multiline
          numberOfLines={3}
          maxLength={500}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Category</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
            style={styles.picker}
          >
            {categories.map((category) => (
              <Picker.Item
                key={category.id}
                label={category.name}
                value={category.id}
              />
            ))}
          </Picker>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Quantity</Text>
        <TextInput
          style={styles.input}
          value={formData.quantity.toString()}
          onChangeText={(text) => {
            const quantity = parseInt(text) || 1;
            setFormData({ ...formData, quantity: Math.max(1, quantity) });
          }}
          placeholder="1"
          keyboardType="numeric"
          maxLength={3}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Priority</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={formData.priority}
            onValueChange={(value) => setFormData({ ...formData, priority: value })}
            style={styles.picker}
          >
            <Picker.Item label="Low" value="low" />
            <Picker.Item label="Medium" value="medium" />
            <Picker.Item label="High" value="high" />
          </Picker>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Visibility</Text>
        <View style={styles.visibilityContainer}>
          <TouchableOpacity
            style={[
              styles.visibilityOption,
              !formData.isPersonal && styles.visibilityOptionSelected
            ]}
            onPress={() => setFormData({ ...formData, isPersonal: false })}
          >
            <Icon
              name="group"
              type="material"
              color={!formData.isPersonal ? '#007AFF' : '#8E8E93'}
              size={20}
            />
            <Text style={[
              styles.visibilityText,
              !formData.isPersonal && styles.visibilityTextSelected
            ]}>
              Shared
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.visibilityOption,
              formData.isPersonal && styles.visibilityOptionSelected
            ]}
            onPress={() => setFormData({ ...formData, isPersonal: true })}
          >
            <Icon
              name="person"
              type="material"
              color={formData.isPersonal ? '#007AFF' : '#8E8E93'}
              size={20}
            />
            <Text style={[
              styles.visibilityText,
              formData.isPersonal && styles.visibilityTextSelected
            ]}>
              Personal
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {!formData.isPersonal && (
        <View style={styles.formGroup}>
          <Text style={styles.label}>Assign to Member (Optional)</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.assignedTo}
              onValueChange={(value) => setFormData({ ...formData, assignedTo: value })}
              style={styles.picker}
            >
              <Picker.Item label="Unassigned" value="" />
              {members.map((member) => (
                <Picker.Item
                  key={member.user_id}
                  label={member.profiles?.full_name || member.profiles?.username}
                  value={member.user_id}
                />
              ))}
            </Picker>
          </View>
        </View>
      )}

      <View style={styles.formGroup}>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.notes}
          onChangeText={(text) => setFormData({ ...formData, notes: text })}
          placeholder="Additional notes or reminders"
          multiline
          numberOfLines={3}
          maxLength={500}
        />
      </View>

      <Button
        title="Save Item"
        buttonStyle={styles.saveButton}
        onPress={handleSave}
        loading={loading}
        disabled={loading}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
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
  visibilityContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    overflow: 'hidden',
  },
  visibilityOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'white',
  },
  visibilityOptionSelected: {
    backgroundColor: '#F0F8FF',
  },
  visibilityText: {
    fontSize: 16,
    color: '#8E8E93',
    marginLeft: 8,
  },
  visibilityTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 16,
    marginTop: 20,
  },
});
