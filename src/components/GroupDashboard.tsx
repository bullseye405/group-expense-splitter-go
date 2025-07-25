import { getGroupById } from '@/api/groups';
import { recordGroupView } from '@/api/groupViews';
import {
  createExpense,
  deleteExpense,
  getExpensesByGroupId,
  updateExpense,
  ExpenseWithSplits,
} from '@/api/expenses';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Edit,
  Plus,
  Share,
  Trash2,
  Users,
  ArrowRightLeft,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ExpenseTypeDialog } from './ExpenseTypeDialog';
import { ParticipantsModal } from './ParticipantsModal';
import { ParticipantSelectionModal } from './ParticipantSelectionModal';
import { DebtSettlement } from './DebtSettlement';
import { GroupWithParticipants } from '@/types/group';

export function GroupDashboard() {
  const { groupId } = useParams<{ groupId: string }>();
  const [group, setGroup] = useState<GroupWithParticipants>();
  const [expenses, setExpenses] = useState<ExpenseWithSplits[]>([]);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [showParticipantSelection, setShowParticipantSelection] =
    useState(false);
  const [currentParticipant, setCurrentParticipant] = useState<string | null>(
    null
  );
  const [dialogType, setDialogType] = useState<
    'expense' | 'transfer' | 'income'
  >('expense');
  const [editingExpense, setEditingExpense] =
    useState<ExpenseWithSplits | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const shareUrl = `${window.location.origin}/${groupId}`;

  // Check for existing participant selection in session storage
  useEffect(() => {
    if (groupId) {
      const storedParticipant = sessionStorage.getItem(
        `participant_${groupId}`
      );
      if (storedParticipant) {
        setCurrentParticipant(storedParticipant);
      }
    }
  }, [groupId]);

  const fetchGroupData = useCallback(async () => {
    if (!groupId) return;
    try {
      const { data, error } = await getGroupById(groupId);
      if (error || !data) {
        toast({
          title: 'Error loading group',
          description: error?.message || 'Group not found.',
          variant: 'destructive',
        });
        return;
      }
      setGroup(data);

      // Show participant selection modal if no participant is selected and participants exist
      if (
        !currentParticipant &&
        data.participants &&
        data.participants.length > 0
      ) {
        setShowParticipantSelection(true);
      }
    } catch (error) {
      console.error('Error fetching group:', error);
    }
  }, [groupId, toast, currentParticipant]);

  const fetchExpenses = useCallback(async () => {
    if (!groupId) return;
    try {
      const data = await getExpensesByGroupId(groupId);
      setExpenses(data);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast({
        title: 'Error loading expenses',
        description: 'Could not load expenses for this group.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [groupId, toast]);

  useEffect(() => {
    fetchGroupData();
    fetchExpenses();
  }, [fetchGroupData, fetchExpenses]);

  const handleParticipantSelect = async (participantId: string) => {
    if (!groupId) return;

    setCurrentParticipant(participantId);
    sessionStorage.setItem(`participant_${groupId}`, participantId);

    // Record group view
    try {
      await recordGroupView(groupId, participantId);
    } catch (error) {
      console.error('Error recording group view:', error);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'Link copied!',
        description:
          'Share this link with your friends to add them to the group',
      });
    } catch (error) {
      toast({
        title: 'Could not copy link',
        description: 'Please copy the URL manually',
        variant: 'destructive',
      });
    }
  };

  const handleOpenDialog = (type: 'expense' | 'transfer' | 'income') => {
    setDialogType(type);
    setEditingExpense(null);
    setShowExpenseDialog(true);
  };

  const handleSaveExpense = async (expenseData: {
    description: string;
    amount: number;
    paidBy: string;
    splitMode: 'equal' | 'amount' | 'weight';
    splits: Array<{
      participant_id: string;
      amount: number;
      custom_amount?: number;
      weight?: number;
    }>;
    expenseType: 'expense' | 'transfer' | 'income';
    transferTo?: string;
  }) => {
    if (!groupId || !group) return;

    try {
      const expense = {
        description: expenseData.description,
        amount: expenseData.amount,
        paid_by: expenseData.paidBy,
        group_id: groupId,
        split_type: expenseData.splitMode,
        expense_type: expenseData.expenseType,
      };

      if (editingExpense) {
        await updateExpense(editingExpense.id, expense, expenseData.splits);
        toast({
          title: `${
            expenseData.expenseType.charAt(0).toUpperCase() +
            expenseData.expenseType.slice(1)
          } updated`,
          description: `$${expenseData.amount.toFixed(2)} ${
            expenseData.expenseType
          } has been updated`,
        });
      } else {
        await createExpense(expense, expenseData.splits);
        toast({
          title: `${
            expenseData.expenseType.charAt(0).toUpperCase() +
            expenseData.expenseType.slice(1)
          } added`,
          description: `$${expenseData.amount.toFixed(2)} ${
            expenseData.expenseType
          } has been recorded`,
        });
      }

      setShowExpenseDialog(false);
      setEditingExpense(null);
      fetchExpenses();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast({
        title: 'Error saving',
        description: 'Could not save. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleEditExpense = (expense: ExpenseWithSplits) => {
    setEditingExpense(expense);
    setDialogType(
      (expense.expense_type as 'expense' | 'transfer' | 'income') || 'expense'
    );
    setShowExpenseDialog(true);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await deleteExpense(expenseId);
      toast({
        title: 'Deleted',
        description: 'The item has been removed',
      });
      fetchExpenses();
    } catch (error) {
      console.error('Error deleting:', error);
      toast({
        title: 'Error deleting',
        description: 'Could not delete. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const totalExpenses = expenses
    .filter((e) => e.expense_type === 'expense' || !e.expense_type)
    .reduce((sum, expense) => sum + expense.amount, 0);
  const totalIncome = expenses
    .filter((e) => e.expense_type === 'income')
    .reduce((sum, expense) => sum + expense.amount, 0);

  const getExpenseTypeIcon = (expenseType: string) => {
    switch (expenseType) {
      case 'transfer':
        return <ArrowRightLeft className="w-4 h-4" />;
      case 'income':
        return <TrendingUp className="w-4 h-4" />;
      default:
        return <DollarSign className="w-4 h-4" />;
    }
  };

  const getExpenseTypeColor = (expenseType: string) => {
    switch (expenseType) {
      case 'transfer':
        return 'text-blue-600';
      case 'income':
        return 'text-green-600';
      default:
        return 'text-red-600';
    }
  };

  const getParticipantDisplayName = (participantId: string) => {
    if (participantId === currentParticipant) {
      return 'me';
    }
    return (
      group?.participants?.find((p) => p.id === participantId)?.name ||
      'Unknown'
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading your group...</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🤔</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            Group not found
          </h2>
          <p className="text-slate-600">
            The group you're looking for doesn't exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {group.name}
            </h1>
            <p className="text-slate-600 mt-1">
              {group.description ||
                'Track expenses and settle debts with your group'}
            </p>
          </div>

          <Button
            onClick={handleShare}
            variant="outline"
            size="sm"
            className="border-blue-200 hover:bg-blue-50 hover:border-blue-300 text-blue-600"
          >
            <Share className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Stats */}
          <div className="text-center p-4 rounded-xl bg-gradient-to-br from-red-50 to-red-100 border border-red-200">
            <div className="text-3xl font-bold text-red-600 mb-1">
              ${totalExpenses.toFixed(2)}
            </div>
            <div className="text-sm font-medium text-red-700">
              Total Expenses
            </div>
          </div>

          <div className="text-center p-4 rounded-xl bg-gradient-to-br from-green-50 to-green-100 border border-green-200">
            <div className="text-3xl font-bold text-green-600 mb-1">
              ${totalIncome.toFixed(2)}
            </div>
            <div className="text-sm font-medium text-green-700">
              Total Income
            </div>
          </div>

          <div className="text-center p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
            <div className="text-3xl font-bold text-blue-600 mb-1">
              {group.participants?.length || 0}
            </div>
            <div className="text-sm font-medium text-blue-700">
              Participants
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 justify-end mt-4">
          <Button
            onClick={() => setShowParticipantsModal(true)}
            variant="outline"
            size="sm"
            className="border-purple-200 hover:bg-purple-50 hover:border-purple-300 text-purple-600"
          >
            <Users className="w-4 h-4 mr-2" />
            Manage Participants
          </Button>
          <Button
            onClick={() => handleOpenDialog('expense')}
            size="sm"
            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
            disabled={!group.participants || group.participants.length < 2}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Expense
          </Button>
          <Button
            onClick={() => handleOpenDialog('income')}
            size="sm"
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
            disabled={!group.participants || group.participants.length < 2}
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            Add Income
          </Button>
          <Button
            onClick={() => handleOpenDialog('transfer')}
            size="sm"
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
            disabled={!group.participants || group.participants.length < 2}
          >
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            Add Transfer
          </Button>
        </div>

        {/* Debt Settlement */}
        {expenses.length > 0 && group.participants && groupId && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border-0 p-6">
            <DebtSettlement
              expenses={expenses}
              participants={group.participants}
              groupId={groupId}
              currentParticipant={currentParticipant}
            />
          </div>
        )}

        {/* Recent Transactions */}
        {expenses.length > 0 && (
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-slate-700 to-slate-800 bg-clip-text text-transparent flex items-center">
                <DollarSign className="w-6 h-6 mr-2 text-slate-600" />
                Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {expenses.map((expense) => {
                const paidByName = getParticipantDisplayName(expense.paid_by);
                const expenseType = expense.expense_type || 'expense';

                // Calculate current participant's share
                const myShare = currentParticipant
                  ? expense.expense_splits.find(
                      (split) => split.participant_id === currentParticipant
                    )?.amount || 0
                  : 0;

                return (
                  <div
                    key={expense.id}
                    className="flex justify-between items-center p-5 rounded-xl bg-gradient-to-r from-white to-slate-50 border border-slate-200 hover:shadow-md transition-all duration-200 hover:border-slate-300"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-full ${
                            expenseType === 'transfer'
                              ? 'bg-blue-100'
                              : expenseType === 'income'
                              ? 'bg-green-100'
                              : 'bg-red-100'
                          }`}
                        >
                          <span className={getExpenseTypeColor(expenseType)}>
                            {getExpenseTypeIcon(expenseType)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <span className="font-semibold text-slate-800 text-lg">
                            {expense.description}
                          </span>
                          <div className="text-sm text-slate-600 mt-1">
                            {expenseType === 'transfer'
                              ? 'Transferred'
                              : expenseType === 'income'
                              ? 'Received'
                              : 'Paid'}{' '}
                            by <span className="font-medium">{paidByName}</span>
                            {expenseType !== 'transfer' &&
                              ` • Split ${expense.expense_splits.length} ways`}
                            {myShare > 0 &&
                              expenseType !== 'transfer' &&
                              ` • ${myShare.toFixed(2)}`}
                          </div>
                          {/* {currentParticipant &&
                            myShare > 0 &&
                            expenseType !== 'transfer' && (
                              <div className="text-xs text-slate-500 mt-1">
                                My share:{' '}
                                <span className="font-medium text-slate-700">
                                  ${myShare.toFixed(2)}
                                </span>
                              </div>
                            )} */}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div
                          className={`text-xl font-bold ${getExpenseTypeColor(
                            expenseType
                          )}`}
                        >
                          ${expense.amount.toFixed(2)}
                        </div>
                        {/* {currentParticipant &&
                          myShare > 0 &&
                          expenseType !== 'transfer' && (
                            <div className="text-sm text-slate-600">
                              You: ${myShare.toFixed(2)}
                            </div>
                          )} */}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditExpense(expense)}
                          className="hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      <ParticipantsModal
        open={showParticipantsModal}
        onOpenChange={setShowParticipantsModal}
        participants={group.participants || []}
        onParticipantChange={fetchGroupData}
      />

      <ParticipantSelectionModal
        open={showParticipantSelection}
        onOpenChange={setShowParticipantSelection}
        participants={group.participants || []}
        onParticipantSelect={handleParticipantSelect}
      />

      <ExpenseTypeDialog
        open={showExpenseDialog}
        onOpenChange={(open) => {
          setShowExpenseDialog(open);
          if (!open) setEditingExpense(null);
        }}
        onSave={handleSaveExpense}
        participants={group.participants || []}
        expense={editingExpense}
        isEditing={!!editingExpense}
        type={dialogType}
        currentParticipant={currentParticipant}
      />
    </div>
  );
}
