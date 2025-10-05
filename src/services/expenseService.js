import { supabase } from './supabase/supabaseClient';

class ExpenseService {
  // Create expense with splits
  async createExpense(expenseData, splits) {
    try {
      // Create expense
      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .insert([expenseData])
        .select()
        .single();

      if (expenseError) throw expenseError;

      // Create splits
      if (splits && splits.length > 0) {
        const splitRecords = splits.map(split => ({
          expense_id: expense.id,
          user_id: split.userId,
          amount_owed: split.amount,
          amount_paid: split.userId === expenseData.paid_by ? split.amount : 0,
          is_settled: split.userId === expenseData.paid_by
        }));

        const { error: splitError } = await supabase
          .from('expense_splits')
          .insert(splitRecords);

        if (splitError) throw splitError;
      }

      return expense;
    } catch (error) {
      console.error('Error creating expense:', error);
      throw error;
    }
  }

  // Update expense
  async updateExpense(expenseId, expenseData, splits) {
    try {
      // Update expense
      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .update(expenseData)
        .eq('id', expenseId)
        .select()
        .single();

      if (expenseError) throw expenseError;

      // Delete existing splits
      await supabase
        .from('expense_splits')
        .delete()
        .eq('expense_id', expenseId);

      // Create new splits
      if (splits && splits.length > 0) {
        const splitRecords = splits.map(split => ({
          expense_id: expenseId,
          user_id: split.userId,
          amount_owed: split.amount,
          amount_paid: split.userId === expenseData.paid_by ? split.amount : 0,
          is_settled: split.userId === expenseData.paid_by
        }));

        const { error: splitError } = await supabase
          .from('expense_splits')
          .insert(splitRecords);

        if (splitError) throw splitError;
      }

      return expense;
    } catch (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
  }

  // Delete expense
  async deleteExpense(expenseId) {
    try {
      // Delete splits first
      await supabase
        .from('expense_splits')
        .delete()
        .eq('expense_id', expenseId);

      // Delete expense
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
  }

  // Calculate equal splits
  calculateEqualSplits(totalAmount, memberIds) {
    const perPerson = totalAmount / memberIds.length;
    return memberIds.map(userId => ({
      userId,
      amount: parseFloat(perPerson.toFixed(2))
    }));
  }

  // Get trip expenses
  async getTripExpenses(tripId) {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          paid_by_user:paid_by (
            full_name,
            username
          ),
          expense_splits (
            *,
            user:user_id (
              full_name,
              username
            )
          )
        `)
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching expenses:', error);
      throw error;
    }
  }

  // Calculate balances
  calculateBalances(expenses) {
    const balances = {};

    expenses.forEach(expense => {
      expense.expense_splits.forEach(split => {
        if (!balances[split.user_id]) {
          balances[split.user_id] = {
            userId: split.user_id,
            userName: split.user?.full_name || split.user?.username,
            totalOwed: 0,
            totalPaid: 0,
            balance: 0
          };
        }

        balances[split.user_id].totalOwed += parseFloat(split.amount_owed);
        balances[split.user_id].totalPaid += parseFloat(split.amount_paid);
      });
    });

    // Calculate net balances
    Object.keys(balances).forEach(userId => {
      balances[userId].balance =
        balances[userId].totalPaid - balances[userId].totalOwed;
    });

    return Object.values(balances);
  }

  // Settle expense
  async settleExpense(expenseId, userId) {
    try {
      const { error } = await supabase
        .from('expense_splits')
        .update({
          is_settled: true,
          settled_at: new Date().toISOString(),
          amount_paid: supabase.raw('amount_owed')
        })
        .eq('expense_id', expenseId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error settling expense:', error);
      throw error;
    }
  }

  // Get expense categories
  getCategories() {
    return [
      { id: 'food', label: 'Food & Drinks', icon: 'restaurant', color: '#FF6B6B' },
      { id: 'transport', label: 'Transportation', icon: 'directions-car', color: '#4ECDC4' },
      { id: 'accommodation', label: 'Accommodation', icon: 'hotel', color: '#45B7D1' },
      { id: 'activities', label: 'Activities', icon: 'hiking', color: '#96CEB4' },
      { id: 'shopping', label: 'Shopping', icon: 'shopping-bag', color: '#FFEAA7' },
      { id: 'other', label: 'Other', icon: 'more-horiz', color: '#DDA0DD' }
    ];
  }

  // Calculate custom splits
  calculateCustomSplits(totalAmount, customSplits) {
    const totalCustomAmount = customSplits.reduce((sum, split) => sum + split.amount, 0);
    
    if (Math.abs(totalCustomAmount - totalAmount) > 0.01) {
      throw new Error('Custom split amounts must equal the total expense amount');
    }
    
    return customSplits;
  }

  // Get user's personal expenses for a trip
  async getPersonalExpenses(tripId, userId) {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          paid_by_user:paid_by (
            full_name,
            username
          )
        `)
        .eq('trip_id', tripId)
        .eq('paid_by', userId)
        .eq('is_personal', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching personal expenses:', error);
      throw error;
    }
  }

  // Get user's budget and spending summary
  async getUserBudgetSummary(tripId, userId) {
    try {
      // Get user's budget limit for this trip
      const { data: budgetData, error: budgetError } = await supabase
        .from('trip_budgets')
        .select('*')
        .eq('trip_id', tripId)
        .eq('user_id', userId)
        .maybeSingle();

      if (budgetError) {
        console.error('Error fetching budget data:', budgetError);
      }

      // First, get all shared expenses for this trip
      const { data: sharedExpenseIds, error: sharedIdsError } = await supabase
        .from('expenses')
        .select('id')
        .eq('trip_id', tripId)
        .eq('is_personal', false);

      if (sharedIdsError) {
        console.error('Error fetching shared expense IDs:', sharedIdsError);
      }

      // Then get user's splits for those shared expenses
      let sharedTotal = 0;
      if (sharedExpenseIds && sharedExpenseIds.length > 0) {
        const expenseIds = sharedExpenseIds.map(exp => exp.id);
        const { data: sharedExpenses, error: sharedError } = await supabase
          .from('expense_splits')
          .select('amount_owed')
          .eq('user_id', userId)
          .in('expense_id', expenseIds);

        if (sharedError) {
          console.error('Error fetching shared expenses:', sharedError);
        } else {
          sharedTotal = sharedExpenses?.reduce((sum, exp) => sum + parseFloat(exp.amount_owed || 0), 0) || 0;
        }
      }

      // Get user's personal expenses
      const { data: personalExpenses, error: personalError } = await supabase
        .from('expenses')
        .select('amount')
        .eq('trip_id', tripId)
        .eq('paid_by', userId)
        .eq('is_personal', true);

      if (personalError) {
        console.error('Error fetching personal expenses:', personalError);
      }

      const personalTotal = personalExpenses?.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0) || 0;
      const totalSpent = sharedTotal + personalTotal;

      const budgetLimit = budgetData?.budget_limit || 0;
      const remaining = budgetLimit - totalSpent;
      const percentage = budgetLimit > 0 ? (totalSpent / budgetLimit) * 100 : 0;

      return {
        budgetLimit,
        totalSpent,
        remaining,
        percentage,
        sharedTotal,
        personalTotal,
        isOverBudget: totalSpent > budgetLimit,
        warningThreshold: percentage >= 80
      };
    } catch (error) {
      console.error('Error fetching budget summary:', error);
      throw error;
    }
  }

  // Set user budget for trip
  async setUserBudget(tripId, userId, budgetLimit) {
    try {
      const { data, error } = await supabase
        .from('trip_budgets')
        .upsert({
          trip_id: tripId,
          user_id: userId,
          budget_limit: budgetLimit,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'trip_id,user_id'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error setting budget:', error);
      throw error;
    }
  }

  // Get debt summary between members
  async getDebtSummary(tripId) {
    try {
      const expenses = await this.getTripExpenses(tripId);
      const balances = this.calculateBalances(expenses);
      
      const debts = [];
      const credits = [];
      
      balances.forEach(balance => {
        if (balance.balance > 0) {
          credits.push(balance);
        } else if (balance.balance < 0) {
          debts.push({
            ...balance,
            balance: Math.abs(balance.balance)
          });
        }
      });

      // Calculate optimal settlement suggestions
      const settlements = this.calculateOptimalSettlements(debts, credits);
      
      return {
        debts,
        credits,
        settlements,
        totalDebt: debts.reduce((sum, debt) => sum + debt.balance, 0),
        totalCredit: credits.reduce((sum, credit) => sum + credit.balance, 0)
      };
    } catch (error) {
      console.error('Error calculating debt summary:', error);
      throw error;
    }
  }

  // Calculate optimal settlement suggestions
  calculateOptimalSettlements(debts, credits) {
    const settlements = [];
    const sortedDebts = [...debts].sort((a, b) => b.balance - a.balance);
    const sortedCredits = [...credits].sort((a, b) => b.balance - a.balance);

    let debtIndex = 0;
    let creditIndex = 0;

    while (debtIndex < sortedDebts.length && creditIndex < sortedCredits.length) {
      const debt = sortedDebts[debtIndex];
      const credit = sortedCredits[creditIndex];

      if (debt.balance <= 0 || credit.balance <= 0) break;

      const settlementAmount = Math.min(debt.balance, credit.balance);
      
      settlements.push({
        from: debt.userId,
        fromName: debt.userName,
        to: credit.userId,
        toName: credit.userName,
        amount: parseFloat(settlementAmount.toFixed(2))
      });

      debt.balance -= settlementAmount;
      credit.balance -= settlementAmount;

      if (debt.balance <= 0) debtIndex++;
      if (credit.balance <= 0) creditIndex++;
    }

    return settlements;
  }

  // Mark debt as settled
  async settleDebt(tripId, fromUserId, toUserId, amount) {
    try {
      // Create settlement record
      const { data, error } = await supabase
        .from('debt_settlements')
        .insert({
          trip_id: tripId,
          from_user_id: fromUserId,
          to_user_id: toUserId,
          amount: amount,
          settled_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error settling debt:', error);
      throw error;
    }
  }

  // Get settlement history
  async getSettlementHistory(tripId) {
    try {
      const { data, error } = await supabase
        .from('debt_settlements')
        .select('*')
        .eq('trip_id', tripId)
        .order('settled_at', { ascending: false });

      if (error) throw error;
      
      // Get user details separately
      if (data && data.length > 0) {
        const userIds = [...new Set([
          ...data.map(d => d.from_user_id),
          ...data.map(d => d.to_user_id)
        ])];
        
        const { data: users, error: usersError } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', userIds);
        
        if (usersError) {
          console.error('Error fetching user details:', usersError);
          return data; // Return data without user details if there's an error
        }
        
        // Map user details to settlements
        return data.map(settlement => ({
          ...settlement,
          from_user: users.find(u => u.id === settlement.from_user_id),
          to_user: users.find(u => u.id === settlement.to_user_id)
        }));
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching settlement history:', error);
      throw error;
    }
  }

  // Calculate how much money others owe the current user
  calculateTotalOwedToMe(expenses, currentUserId) {
    if (!expenses || expenses.length === 0) {
      return 0;
    }

    let totalOwed = 0;

    expenses.forEach(expense => {
      if (expense.paid_by === currentUserId && !expense.is_personal) {
        const numberOfParticipants = expense.expense_splits ? expense.expense_splits.length : 0;
        
        if (numberOfParticipants > 1) {
          const myShare = expense.amount / numberOfParticipants;
          const othersShare = expense.amount - myShare;
          totalOwed += othersShare;
        }
      }
    });

    return parseFloat(totalOwed.toFixed(2));
  }

  // Calculate how much the current user owes to others
  calculateTotalIowe(expenses, currentUserId) {
    if (!expenses || expenses.length === 0) {
      return 0;
    }

    let totalIOwe = 0;

    expenses.forEach(expense => {
      if (expense.paid_by !== currentUserId && !expense.is_personal) {
        const userSplit = expense.expense_splits?.find(split => split.user_id === currentUserId);
        if (userSplit) {
          totalIOwe += parseFloat(userSplit.amount_owed || 0);
        }
      }
    });

    return parseFloat(totalIOwe.toFixed(2));
  }

  // Get detailed debt breakdown for current user
  async getDetailedDebtBreakdown(tripId, currentUserId) {
    try {
      const expenses = await this.getTripExpenses(tripId);
      
      const youOweToOthers = [];
      const othersOweToYou = [];
      let totalYouOwe = 0;
      let totalOwedToYou = 0;

      // Track individual member balances
      const memberBalances = {};

      expenses.forEach(expense => {
        if (expense.is_personal) return;

        const userSplit = expense.expense_splits?.find(split => split.user_id === currentUserId);
        const paidByUser = expense.paid_by_user;
        
        if (expense.paid_by === currentUserId) {
          // I paid for this expense - others owe me
          const myShare = expense.amount / expense.expense_splits.length;
          const othersShare = expense.amount - myShare;
          
          if (othersShare > 0) {
            othersOweToYou.push({
              expenseId: expense.id,
              expenseTitle: expense.title,
              expenseAmount: expense.amount,
              myShare: myShare,
              othersShare: othersShare,
              participants: expense.expense_splits.map(split => ({
                userId: split.user_id,
                userName: split.user?.full_name || split.user?.username,
                amount: parseFloat(split.amount_owed)
              })).filter(participant => participant.userId !== currentUserId)
            });
            totalOwedToYou += othersShare;

            // Track individual amounts owed to me
            expense.expense_splits.forEach(split => {
              if (split.user_id !== currentUserId) {
                const userId = split.user_id;
                if (!memberBalances[userId]) {
                  memberBalances[userId] = {
                    userId: userId,
                    userName: split.user?.full_name || split.user?.username,
                    owesMe: 0,
                    iOweThem: 0,
                    netOwesMe: 0
                  };
                }
                memberBalances[userId].owesMe += parseFloat(split.amount_owed);
              }
            });
          }
        } else if (userSplit) {
          // Someone else paid and I'm a participant - I owe them
          youOweToOthers.push({
            expenseId: expense.id,
            expenseTitle: expense.title,
            expenseAmount: expense.amount,
            amountIOwe: parseFloat(userSplit.amount_owed),
            paidBy: {
              userId: expense.paid_by,
              userName: paidByUser?.full_name || paidByUser?.username
            }
          });
          totalYouOwe += parseFloat(userSplit.amount_owed);

          // Track individual amounts I owe
          const paidByUserId = expense.paid_by;
          if (!memberBalances[paidByUserId]) {
            memberBalances[paidByUserId] = {
              userId: paidByUserId,
              userName: paidByUser?.full_name || paidByUser?.username,
              owesMe: 0,
              iOweThem: 0,
              netOwesMe: 0
            };
          }
          memberBalances[paidByUserId].iOweThem += parseFloat(userSplit.amount_owed);
        }
      });

      // Calculate net amounts for each member
      Object.keys(memberBalances).forEach(userId => {
        const balance = memberBalances[userId];
        balance.netOwesMe = balance.owesMe - balance.iOweThem;
      });

      // Calculate overall net amounts
      const netBalance = totalOwedToYou - totalYouOwe;
      const netYouOwe = netBalance < 0 ? Math.abs(netBalance) : 0;
      const netOwedToYou = netBalance > 0 ? netBalance : 0;

      // Separate members into those who owe me and those I owe
      const membersWhoOweMe = Object.values(memberBalances).filter(member => member.netOwesMe > 0);
      const membersIOwe = Object.values(memberBalances).filter(member => member.netOwesMe < 0);

      return {
        youOweToOthers,
        othersOweToYou,
        totalYouOwe: netYouOwe,
        totalOwedToYou: netOwedToYou,
        // Keep original totals for detailed breakdown
        originalTotalYouOwe: totalYouOwe,
        originalTotalOwedToYou: totalOwedToYou,
        netBalance: netBalance,
        // New per-member breakdown
        membersWhoOweMe,
        membersIOwe,
        allMemberBalances: Object.values(memberBalances)
      };
    } catch (error) {
      console.error('Error getting detailed debt breakdown:', error);
      throw error;
    }
  }

  // Mark a member as paid for their debt
  async markMemberAsPaid(tripId, fromUserId, toUserId, amount) {
    try {
      const { data, error } = await supabase
        .from('debt_payments')
        .insert({
          trip_id: tripId,
          from_user_id: fromUserId,
          to_user_id: toUserId,
          amount: amount,
          paid_at: new Date().toISOString(),
          status: 'completed'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error marking member as paid:', error);
      throw error;
    }
  }

  // Get payment history for a trip
  async getPaymentHistory(tripId) {
    try {
      const { data, error } = await supabase
        .from('debt_payments')
        .select(`
          *,
          from_user:from_user_id (
            id,
            full_name,
            username
          ),
          to_user:to_user_id (
            id,
            full_name,
            username
          )
        `)
        .eq('trip_id', tripId)
        .order('paid_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching payment history:', error);
      throw error;
    }
  }
}

export default new ExpenseService();