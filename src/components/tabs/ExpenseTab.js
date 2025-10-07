import { format } from 'date-fns';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Button, Card, Icon } from 'react-native-elements';
import expenseService from '../../services/expenseService';
import groupTripService from '../../services/groupTripService';
import { supabase } from '../../services/supabase/supabaseClient';
import BudgetModal from '../expense/BudgetModal';
import DebtModal from '../expense/DebtModal';
import ExpenseForm from '../expense/ExpenseForm';

export default function ExpenseTab({ tripId, userRole }) {
  const [activeTab, setActiveTab] = useState('shared');
  const [expenses, setExpenses] = useState([]);
  const [personalExpenses, setPersonalExpenses] = useState([]);
  const [members, setMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [budgetSummary, setBudgetSummary] = useState(null);
  const [debtSummary, setDebtSummary] = useState(null);
  const [detailedDebtBreakdown, setDetailedDebtBreakdown] = useState(null);
  const [expandedSplits, setExpandedSplits] = useState(new Set());
  const [expandedDebtSections, setExpandedDebtSections] = useState({
    youOwe: false,
    othersOwe: false
  });

  // Form states
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    amount: '',
    category: 'food',
    description: '',
    isPersonal: false,
    paidBy: '',
    participants: [],
    customSplits: []
  });

  useEffect(() => {
    fetchData();
  }, [tripId]);

  useEffect(() => {
    if (currentUser) {
      fetchDetailedDebtBreakdown();
      fetchBudgetSummary();
    }
  }, [currentUser]);

  const fetchData = async () => {
    await Promise.all([
      fetchExpenses(),
      fetchMembers(),
      fetchCurrentUser(),
      fetchBudgetSummary(),
      fetchDebtSummary()
    ]);
  };

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const sharedExpenses = await expenseService.getTripExpenses(tripId);
      setExpenses(sharedExpenses || []);
      
      if (currentUser) {
        const personalExpenses = await expenseService.getPersonalExpenses(tripId, currentUser.id);
        setPersonalExpenses(personalExpenses || []);
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
      Alert.alert('Error', 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const membersData = await groupTripService.getTripMembers(tripId);
      setMembers(membersData || []);
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const fetchBudgetSummary = async () => {
    if (!currentUser) return;
    try {
      const summary = await expenseService.getUserBudgetSummary(tripId, currentUser.id);
      setBudgetSummary(summary);
    } catch (error) {
      console.error('Error fetching budget summary:', error);
      // Set default values if there's an error
      const defaultSummary = {
        budgetLimit: 0,
        totalSpent: 0,
        remaining: 0,
        percentage: 0,
        sharedTotal: 0,
        personalTotal: 0,
        isOverBudget: false,
        warningThreshold: false
      };
      setBudgetSummary(defaultSummary);
    }
  };

  const fetchDebtSummary = async () => {
    try {
      const summary = await expenseService.getDebtSummary(tripId);
      setDebtSummary(summary);
    } catch (error) {
      console.error('Error fetching debt summary:', error);
    }
  };

  const fetchDetailedDebtBreakdown = async () => {
    if (!currentUser) return;
    try {
      const breakdown = await expenseService.getDetailedDebtBreakdown(tripId, currentUser.id);
      setDetailedDebtBreakdown(breakdown);
    } catch (error) {
      console.error('Error fetching detailed debt breakdown:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    if (currentUser) {
      await fetchDetailedDebtBreakdown();
    }
    setRefreshing(false);
  };

  const resetForm = () => {
    setExpenseForm({
      title: '',
      amount: '',
      category: 'food',
      description: '',
      isPersonal: false,
      paidBy: currentUser?.id || '',
      participants: [],
      customSplits: []
    });
  };

  const handleAddExpense = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleEditExpense = (expense) => {
    setSelectedExpense(expense);
    setExpenseForm({
      title: expense.title,
      amount: expense.amount.toString(),
      category: expense.category,
      description: expense.description || '',
      isPersonal: expense.is_personal,
      paidBy: expense.paid_by,
      participants: expense.expense_splits?.map(split => split.user_id) || [],
      customSplits: expense.expense_splits?.map(split => ({
        userId: split.user_id,
        amount: parseFloat(split.amount_owed)
      })) || []
    });
    setShowEditModal(true);
  };

  const handleDeleteExpense = (expense) => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await expenseService.deleteExpense(expense.id);
              await fetchExpenses();
              Alert.alert('Success', 'Expense deleted successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete expense');
            }
          }
        }
      ]
    );
  };

  const toggleSplitDetails = (expenseId) => {
    setExpandedSplits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(expenseId)) {
        newSet.delete(expenseId);
      } else {
        newSet.add(expenseId);
      }
      return newSet;
    });
  };

  const toggleDebtSection = (section) => {
    setExpandedDebtSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleMarkAsPaid = async (userId, amount) => {
    Alert.alert(
      'Mark as Paid',
      `Mark ${amount.toFixed(2)} as paid?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark as Paid',
          onPress: async () => {
            try {
              await expenseService.markMemberAsPaid(tripId, userId, currentUser.id, amount);
              Alert.alert('Success', 'Payment marked as completed');
              // Refresh the debt breakdown
              await fetchDetailedDebtBreakdown();
            } catch (error) {
              console.error('Error marking as paid:', error);
              Alert.alert('Error', 'Failed to mark as paid');
            }
          }
        }
      ]
    );
  };

  const handleUndoPayment = async (settlementId, userName) => {
    Alert.alert(
      'Undo Payment',
      `Undo payment to ${userName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Undo',
          style: 'destructive',
          onPress: async () => {
            try {
              await expenseService.undoPayment(settlementId);
              Alert.alert('Success', 'Payment undone');
              // Refresh the debt breakdown
              await fetchDetailedDebtBreakdown();
            } catch (error) {
              console.error('Error undoing payment:', error);
              Alert.alert('Error', 'Failed to undo payment');
            }
          }
        }
      ]
    );
  };

  // Current user paid another member (You Owe To Others -> I Paid)
  const handleIPaid = async (toUserId, amount) => {
    Alert.alert(
      'Confirm Payment',
      `Confirm you paid $${amount.toFixed(2)} to this member?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'I Paid',
          onPress: async () => {
            try {
              await expenseService.markMemberAsPaid(tripId, currentUser.id, toUserId, amount);
              Alert.alert('Success', 'Your payment was recorded');
              await fetchDetailedDebtBreakdown();
            } catch (error) {
              console.error('Error recording payment:', error);
              Alert.alert('Error', 'Failed to record payment');
            }
          }
        }
      ]
    );
  };

  const canEditExpense = (expense) => {
    if (!currentUser) return false;
    // Allow if user is the trip owner or the expense creator
    return userRole === 'owner' || expense.paid_by === currentUser.id;
  };

  const saveExpense = async () => {
    if (!expenseForm.title || !expenseForm.amount || !expenseForm.paidBy) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      
      const expenseData = {
        trip_id: tripId,
        title: expenseForm.title,
        amount: parseFloat(expenseForm.amount),
        category: expenseForm.category,
        description: expenseForm.description,
        paid_by: expenseForm.paidBy,
        is_personal: expenseForm.isPersonal
      };

      let splits = [];
      if (!expenseForm.isPersonal && expenseForm.participants.length > 0) {
        if (expenseForm.customSplits.length > 0) {
          splits = expenseForm.customSplits;
        } else {
          splits = expenseService.calculateEqualSplits(
            parseFloat(expenseForm.amount),
            expenseForm.participants
          );
        }
      }

      if (selectedExpense) {
        await expenseService.updateExpense(selectedExpense.id, expenseData, splits);
        Alert.alert('Success', 'Expense updated successfully');
        setShowEditModal(false);
      } else {
        await expenseService.createExpense(expenseData, splits);
        Alert.alert('Success', 'Expense added successfully');
        setShowAddModal(false);
      }

      resetForm();
      setSelectedExpense(null);
      await fetchData();
    } catch (error) {
      console.error('Error saving expense:', error);
      Alert.alert('Error', 'Failed to save expense');
    } finally {
      setLoading(false);
    }
  };

  const renderExpenseCard = (expense) => {
    const category = expenseService.getCategories().find(cat => cat.id === expense.category);
    const paidByUser = members.find(member => member.user_id === expense.paid_by);
    
    return (
      <Card key={expense.id} containerStyle={styles.expenseCard}>
        <View style={styles.expenseHeader}>
          <View style={styles.expenseInfo}>
            <View style={[styles.categoryIcon, { backgroundColor: category?.color || '#DDA0DD' }]}>
              <Icon name={category?.icon || 'more-horiz'} type="material" color="white" size={20} />
            </View>
            <View style={styles.expenseDetails}>
              <Text style={styles.expenseTitle}>{expense.title}</Text>
              <Text style={styles.expenseCategory}>{category?.label}</Text>
              <Text style={styles.expenseDate}>
                {format(new Date(expense.created_at), 'MMM dd, yyyy')}
              </Text>
            </View>
          </View>
          <View style={styles.expenseAmount}>
            <Text style={styles.amountText}>${expense.amount.toFixed(2)}</Text>
            <Text style={styles.paidByText}>
              Paid by {paidByUser?.profiles?.full_name || paidByUser?.profiles?.username}
            </Text>
          </View>
        </View>
        
        {expense.description && (
          <Text style={styles.expenseDescription}>{expense.description}</Text>
        )}

        {!expense.is_personal && expense.expense_splits && (
          <View style={styles.splitsContainer}>
            <TouchableOpacity 
              style={styles.splitsHeader}
              onPress={() => toggleSplitDetails(expense.id)}
            >
              <Text style={styles.splitsTitle}>Split between:</Text>
              <Icon 
                name={expandedSplits.has(expense.id) ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
                type="material" 
                size={20} 
                color="#007AFF" 
              />
            </TouchableOpacity>
            {expandedSplits.has(expense.id) && (
              <View style={styles.splitsList}>
                {expense.expense_splits.map((split, index) => {
                  const user = members.find(member => member.user_id === split.user_id);
                  return (
                    <View key={index} style={styles.splitItem}>
                      <Text style={styles.splitUser}>
                        {user?.profiles?.full_name || user?.profiles?.username}
                      </Text>
                      <Text style={styles.splitAmount}>
                        ${parseFloat(split.amount_owed).toFixed(2)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {canEditExpense(expense) && (
          <View style={styles.expenseActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleEditExpense(expense)}
            >
              <Icon name="edit" type="material" size={16} color="#007AFF" />
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDeleteExpense(expense)}
            >
              <Icon name="delete" type="material" size={16} color="#FF3B30" />
              <Text style={styles.actionText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </Card>
    );
  };

  const renderBudgetSummary = () => {
    if (!budgetSummary) return null;

    return (
      <Card containerStyle={styles.budgetCard}>
        <View style={styles.budgetHeader}>
          <Icon name="account-balance-wallet" type="material" size={24} color="#007AFF" />
          <Text style={styles.budgetTitle}>Your Budget</Text>
        </View>
        
        <View style={styles.budgetStats}>
          <View style={styles.budgetStat}>
            <Text style={styles.budgetLabel}>Budget Limit</Text>
            <Text style={styles.budgetValue}>
              ${budgetSummary.budgetLimit.toFixed(2)}
            </Text>
          </View>
          <View style={styles.budgetStat}>
            <Text style={styles.budgetLabel}>Total Spent</Text>
            <Text style={[
              styles.budgetValue,
              budgetSummary.isOverBudget && styles.overBudgetText
            ]}>
              ${budgetSummary.totalSpent.toFixed(2)}
            </Text>
          </View>
          <View style={styles.budgetStat}>
            <Text style={styles.budgetLabel}>Remaining</Text>
            <Text style={[
              styles.budgetValue,
              budgetSummary.remaining < 0 && styles.overBudgetText
            ]}>
              ${budgetSummary.remaining.toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                { 
                  width: `${Math.min(budgetSummary.percentage, 100)}%`,
                  backgroundColor: budgetSummary.isOverBudget ? '#FF3B30' : 
                                 budgetSummary.warningThreshold ? '#FF9500' : '#34C759'
                }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {budgetSummary.percentage.toFixed(1)}% used
          </Text>
        </View>

        {budgetSummary.warningThreshold && (
          <View style={styles.warningContainer}>
            <Icon name="warning" type="material" size={16} color="#FF9500" />
            <Text style={styles.warningText}>
              {budgetSummary.isOverBudget ? 'Over budget!' : 'Approaching budget limit'}
            </Text>
          </View>
        )}

        <Button
          title="Set Budget"
          buttonStyle={styles.budgetButton}
          onPress={() => setShowBudgetModal(true)}
        />
      </Card>
    );
  };

  const renderDebtSummary = () => {
    if (!detailedDebtBreakdown) {
      return null;
    }

    const { 
      youOweToOthers, 
      othersOweToYou, 
      totalYouOwe, 
      totalOwedToYou, 
      netBalance,
      membersWhoOweMe,
      membersIOwe
    } = detailedDebtBreakdown;

    // Compute section header totals from per-member nets so headers match breakdown
    const sectionTotalYouOwe = (membersIOwe || []).reduce((sum, member) => {
      const v = parseFloat(member?.netOwesMe || 0);
      return sum + Math.abs(v < 0 ? v : 0);
    }, 0);
    const sectionTotalOwedToYou = (membersWhoOweMe || []).reduce((sum, member) => {
      const v = parseFloat(member?.netOwesMe || 0);
      return sum + (v > 0 ? v : 0);
    }, 0);

    return (
      
      <View>
        {/* You Owe To Others Section - Always show */}
        <Card containerStyle={styles.debtCard}>
          <TouchableOpacity 
            style={styles.debtSectionHeader}
            onPress={() => toggleDebtSection('youOwe')}
          >
            <View style={styles.debtSectionTitleContainer}>
              <Icon name="arrow-upward" type="material" size={24} color="#FF3B30" />
              <Text style={styles.debtSectionTitle}>You Owe To Others</Text>
            </View>
            <View style={styles.debtSectionAmountContainer}>
              <Text style={[
                styles.debtSectionAmount, 
                { color: '#FF3B30' },
                sectionTotalYouOwe >= 1000 && styles.largeAmountText
              ]}>
                ${sectionTotalYouOwe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Icon 
                name={expandedDebtSections.youOwe ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
                type="material" 
                size={20} 
                color="#8E8E93" 
              />
            </View>
          </TouchableOpacity>

          {expandedDebtSections.youOwe && (
            <View style={styles.debtDetailsContainer}>
              <Text style={styles.netBalanceText}>
                Net amount you owe after all settlements
              </Text>
              
              {membersIOwe.length > 0 ? (
                <View style={styles.breakdownContainer}>
                  <Text style={styles.breakdownTitle}>Per Member Breakdown:</Text>
                  {membersIOwe.map((member, index) => (
                    <View key={index} style={styles.memberDebtItem}>
                      <View style={styles.memberDebtHeader}>
                        <Text style={styles.memberDebtName}>{member.userName}</Text>
                        <Text style={styles.memberDebtAmount}>
                          ${Math.abs(member.netOwesMe).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                      </View>
                      <Text style={styles.memberDebtDetails}>
                        You owe {member.userName} after netting all expenses
                      </Text>
                      {member.paymentStatus === 'paid' ? (
                        <View style={styles.paidStatusContainer}>
                          <View style={styles.paidStatus}>
                            <Icon name="check-circle" type="material" size={16} color="#34C759" />
                            <Text style={styles.paidStatusText}>Paid</Text>
                          </View>
                          <TouchableOpacity 
                            style={styles.undoButton}
                            onPress={() => handleUndoPayment(member.settlementId, member.userName)}
                          >
                            <Icon name="undo" type="material" size={16} color="#FF3B30" />
                            <Text style={styles.undoText}>Undo</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity 
                          style={styles.markPaidButton}
                          onPress={() => handleIPaid(member.userId, Math.abs(member.netOwesMe))}
                        >
                          <Icon name="check" type="material" size={16} color="white" />
                          <Text style={styles.markPaidText}>I Paid</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noDebtsText}>You don't owe anyone anything!</Text>
              )}
            </View>
          )}
        </Card>

        {/* Others Owe To You Section - Always show */}
        <Card containerStyle={styles.debtCard}>
          <TouchableOpacity 
            style={styles.debtSectionHeader}
            onPress={() => toggleDebtSection('othersOwe')}
          >
            <View style={styles.debtSectionTitleContainer}>
              <Icon name="arrow-downward" type="material" size={24} color="#34C759" />
              <Text style={styles.debtSectionTitle}>Others Owe To You</Text>
            </View>
            <View style={styles.debtSectionAmountContainer}>
              <Text style={[
                styles.debtSectionAmount, 
                { color: '#34C759' },
                sectionTotalOwedToYou >= 1000 && styles.largeAmountText
              ]}>
                ${sectionTotalOwedToYou.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Icon 
                name={expandedDebtSections.othersOwe ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
                type="material" 
                size={20} 
                color="#8E8E93" 
              />
            </View>
          </TouchableOpacity>

          {expandedDebtSections.othersOwe && (
            <View style={styles.debtDetailsContainer}>
              <Text style={styles.netBalanceText}>
                Net amount others owe you after all settlements
              </Text>
              
              {membersWhoOweMe.length > 0 ? (
                <View style={styles.breakdownContainer}>
                  <Text style={styles.breakdownTitle}>Per Member Breakdown:</Text>
                  {membersWhoOweMe.map((member, index) => (
                    <View key={index} style={styles.memberDebtItem}>
                      <View style={styles.memberDebtHeader}>
                        <Text style={styles.memberDebtName}>{member.userName}</Text>
                        <Text style={styles.memberDebtAmount}>
                          ${member.netOwesMe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                      </View>
                      <Text style={styles.memberDebtDetails}>
                        {member.userName} owes you after netting all expenses
                      </Text>
                      {member.paymentStatus === 'received' ? (
                        <View style={styles.paidStatusContainer}>
                          <View style={styles.paidStatus}>
                            <Icon name="check-circle" type="material" size={16} color="#34C759" />
                            <Text style={styles.paidStatusText}>Paid</Text>
                          </View>
                          <TouchableOpacity 
                            style={styles.undoButton}
                            onPress={() => handleUndoPayment(member.settlementId, member.userName)}
                          >
                            <Icon name="undo" type="material" size={16} color="#FF3B30" />
                            <Text style={styles.undoText}>Undo</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity 
                          style={styles.markPaidButton}
                          onPress={() => handleMarkAsPaid(member.userId, member.netOwesMe)}
                        >
                          <Icon name="check" type="material" size={16} color="white" />
                          <Text style={styles.markPaidText}>Mark as Paid</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noDebtsText}>No one owes you anything!</Text>
              )}
            </View>
          )}
        </Card>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Expenses</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddExpense}>
          <Icon name="add" type="material" color="white" size={24} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'shared' && styles.activeTab]}
          onPress={() => setActiveTab('shared')}
        >
          <Text style={[styles.tabText, activeTab === 'shared' && styles.activeTabText]}>
            Shared
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'personal' && styles.activeTab]}
          onPress={() => setActiveTab('personal')}
        >
          <Text style={[styles.tabText, activeTab === 'personal' && styles.activeTabText]}>
            Personal
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'summary' && styles.activeTab]}
          onPress={() => setActiveTab('summary')}
        >
          <Text style={[styles.tabText, activeTab === 'summary' && styles.activeTabText]}>
            Summary
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'shared' && (
          <View>
            {expenses.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="receipt" type="material" size={64} color="#C7C7CC" />
                <Text style={styles.emptyText}>No shared expenses yet</Text>
                <Text style={styles.emptySubtext}>Add an expense to get started</Text>
              </View>
            ) : (
              expenses.map(expense => renderExpenseCard(expense))
            )}
          </View>
        )}

        {activeTab === 'personal' && (
          <View>
            {personalExpenses.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="person" type="material" size={64} color="#C7C7CC" />
                <Text style={styles.emptyText}>No personal expenses yet</Text>
                <Text style={styles.emptySubtext}>Track your personal spending</Text>
              </View>
            ) : (
              personalExpenses.map(expense => renderExpenseCard(expense))
            )}
          </View>
        )}

        {activeTab === 'summary' && (
          <View>
            {renderBudgetSummary()}
            {renderDebtSummary()}
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Expense Modal */}
      <Modal
        visible={showAddModal || showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              setShowAddModal(false);
              setShowEditModal(false);
              resetForm();
            }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {selectedExpense ? 'Edit Expense' : 'Add Expense'}
            </Text>
            <TouchableOpacity onPress={saveExpense} disabled={loading}>
              <Text style={[styles.saveText, loading && styles.disabledText]}>
                {loading ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <ExpenseForm
              formData={expenseForm}
              setFormData={setExpenseForm}
              members={members}
              currentUser={currentUser}
              onSave={saveExpense}
              loading={loading}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Debt Management Modal */}
      <DebtModal
        visible={showDebtModal}
        onClose={() => setShowDebtModal(false)}
        tripId={tripId}
        members={members}
      />

      {/* Budget Management Modal */}
      <BudgetModal
        visible={showBudgetModal}
        onClose={() => setShowBudgetModal(false)}
        tripId={tripId}
        currentUser={currentUser}
        onBudgetUpdated={fetchBudgetSummary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  expenseCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  expenseInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseDetails: {
    flex: 1,
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  expenseCategory: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  expenseDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  expenseAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  paidByText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  expenseDescription: {
    fontSize: 14,
    color: '#000',
    marginBottom: 12,
    lineHeight: 20,
  },
  splitsContainer: {
    marginBottom: 12,
  },
  splitsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  splitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  splitsList: {
    marginTop: 8,
  },
  splitItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  splitUser: {
    fontSize: 14,
    color: '#000',
  },
  splitAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  expenseActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  actionText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 4,
  },
  budgetCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  budgetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginLeft: 8,
  },
  budgetStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  budgetStat: {
    alignItems: 'center',
  },
  budgetLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  budgetValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  overBudgetText: {
    color: '#FF3B30',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    marginLeft: 8,
  },
  budgetButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  debtCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  debtSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 48,
  },
  debtSectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  debtSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginLeft: 8,
    flexShrink: 1,
  },
  debtSectionAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    minWidth: 100,
    maxWidth: 150,
    justifyContent: 'flex-end',
  },
  debtSectionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
    textAlign: 'right',
    flexShrink: 1,
    numberOfLines: 1,
  },
  debtDetailsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  debtItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  debtItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  debtItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  debtItemAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  debtItemDetails: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  participantsList: {
    marginTop: 8,
  },
  participantText: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  noDebtsText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  cancelText: {
    fontSize: 16,
    color: '#007AFF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  saveText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  disabledText: {
    color: '#8E8E93',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  placeholderText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 32,
  },
  netBalanceText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  breakdownContainer: {
    marginTop: 8,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  balancedContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  balancedTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#34C759',
    marginTop: 16,
    marginBottom: 8,
  },
  balancedText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  memberDebtItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  memberDebtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  memberDebtName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  memberDebtAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    textAlign: 'right',
    flexShrink: 1,
    minWidth: 80,
  },
  memberDebtDetails: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  markPaidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  markPaidText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
    marginLeft: 4,
  },
  largeAmountText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  paidStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  paidStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    marginRight: 8,
  },
  paidStatusText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
    marginLeft: 4,
  },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE8E8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  undoText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '600',
    marginLeft: 4,
  },
});
