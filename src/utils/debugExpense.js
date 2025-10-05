// Debug utility for expense management
import { supabase } from '../services/supabase/supabaseClient';

export const debugExpenseTables = async () => {
  try {
    console.log('🔍 Debugging Expense Tables...');
    
    // Check if tables exist and have data
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .limit(5);
    
    console.log('📊 Expenses table:', expensesError ? 'ERROR' : 'OK', expenses?.length || 0, 'records');
    if (expensesError) console.error('Expenses error:', expensesError);
    
    const { data: expenseSplits, error: splitsError } = await supabase
      .from('expense_splits')
      .select('*')
      .limit(5);
    
    console.log('💰 Expense splits table:', splitsError ? 'ERROR' : 'OK', expenseSplits?.length || 0, 'records');
    if (splitsError) console.error('Splits error:', splitsError);
    
    const { data: tripBudgets, error: budgetsError } = await supabase
      .from('trip_budgets')
      .select('*')
      .limit(5);
    
    console.log('💳 Trip budgets table:', budgetsError ? 'ERROR' : 'OK', tripBudgets?.length || 0, 'records');
    if (budgetsError) console.error('Budgets error:', budgetsError);
    
    const { data: debtSettlements, error: settlementsError } = await supabase
      .from('debt_settlements')
      .select('*')
      .limit(5);
    
    console.log('🤝 Debt settlements table:', settlementsError ? 'ERROR' : 'OK', debtSettlements?.length || 0, 'records');
    if (settlementsError) console.error('Settlements error:', settlementsError);
    
    // Check current user
    const { data: { user } } = await supabase.auth.getUser();
    console.log('👤 Current user:', user ? user.id : 'Not logged in');
    
    return {
      expenses: expenses?.length || 0,
      expenseSplits: expenseSplits?.length || 0,
      tripBudgets: tripBudgets?.length || 0,
      debtSettlements: debtSettlements?.length || 0,
      user: user ? user.id : null
    };
  } catch (error) {
    console.error('🚨 Debug error:', error);
    return null;
  }
};

export const testBudgetSummary = async (tripId, userId) => {
  try {
    console.log('🧪 Testing Budget Summary for trip:', tripId, 'user:', userId);
    
    // Test budget data
    const { data: budgetData, error: budgetError } = await supabase
      .from('trip_budgets')
      .select('*')
      .eq('trip_id', tripId)
      .eq('user_id', userId)
      .maybeSingle();
    
    console.log('💳 Budget data:', budgetData, budgetError);
    
    // Test shared expenses
    const { data: sharedExpenseIds, error: sharedIdsError } = await supabase
      .from('expenses')
      .select('id')
      .eq('trip_id', tripId)
      .eq('is_personal', false);
    
    console.log('📊 Shared expense IDs:', sharedExpenseIds, sharedIdsError);
    
    // Test personal expenses
    const { data: personalExpenses, error: personalError } = await supabase
      .from('expenses')
      .select('amount')
      .eq('trip_id', tripId)
      .eq('paid_by', userId)
      .eq('is_personal', true);
    
    console.log('👤 Personal expenses:', personalExpenses, personalError);
    
    return {
      budgetData,
      sharedExpenseIds,
      personalExpenses,
      errors: {
        budgetError,
        sharedIdsError,
        personalError
      }
    };
  } catch (error) {
    console.error('🚨 Test error:', error);
    return null;
  }
};
