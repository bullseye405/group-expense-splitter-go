
import { getGroupById } from '@/api/groups';
import { createExpense, deleteExpense, getExpensesByGroupId, updateExpense, ExpenseWithSplits } from '@/api/expenses';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Edit, Plus, Share, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AddParticipantDialog } from './AddParticipantDialog';
import { ExpenseDialog } from './ExpenseDialog';
import { Group } from '@/types/group';

export function GroupDashboard() {
  const { groupId } = useParams<{ groupId: string }>();
  const [group, setGroup] = useState<Group>();
  const [expenses, setExpenses] = useState<ExpenseWithSplits[]>([]);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseWithSplits | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const shareUrl = `${window.location.origin}?group=${groupId}`;

  const fetchGroupData = async () => {
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
    } catch (error) {
      console.error('Error fetching group:', error);
    }
  };

  const fetchExpenses = async () => {
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
  };

  useEffect(() => {
    fetchGroupData();
    fetchExpenses();
  }, [groupId]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'Link copied!',
        description: 'Share this link with your friends to add them to the group',
      });
    } catch (error) {
      toast({
        title: 'Could not copy link',
        description: 'Please copy the URL manually',
        variant: 'destructive',
      });
    }
  };

  const addParticipant = (name: string) => {
    fetchGroupData();
    setShowAddParticipant(false);
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
  }) => {
    if (!groupId || !group) return;

    try {
      const expense = {
        description: expenseData.description,
        amount: expenseData.amount,
        paid_by: expenseData.paidBy,
        group_id: groupId,
        split_type: expenseData.splitMode,
      };

      if (editingExpense) {
        await updateExpense(editingExpense.id, expense, expenseData.splits);
        toast({
          title: 'Expense updated',
          description: `$${expenseData.amount.toFixed(2)} expense has been updated`,
        });
      } else {
        await createExpense(expense, expenseData.splits);
        toast({
          title: 'Expense added',
          description: `$${expenseData.amount.toFixed(2)} expense has been recorded`,
        });
      }

      setShowExpenseDialog(false);
      setEditingExpense(null);
      fetchExpenses();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast({
        title: 'Error saving expense',
        description: 'Could not save the expense. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleEditExpense = (expense: ExpenseWithSplits) => {
    setEditingExpense(expense);
    setShowExpenseDialog(true);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await deleteExpense(expenseId);
      toast({
        title: 'Expense deleted',
        description: 'The expense has been removed',
      });
      fetchExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast({
        title: 'Error deleting expense',
        description: 'Could not delete the expense. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const calculateBalances = () => {
    const balances: { [key: string]: number } = {};
    if (!group) return balances;

    // Initialize balances
    group.participants?.forEach((p) => {
      balances[p.id] = 0;
    });

    // Calculate balances from expenses
    expenses.forEach((expense) => {
      // Person who paid gets credited
      balances[expense.paid_by] += expense.amount;

      // People in the split get debited
      expense.expense_splits.forEach((split) => {
        if (split.participant_id) {
          balances[split.participant_id] -= split.amount;
        }
      });
    });

    return balances;
  };

  const balances = calculateBalances();
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="text-center">Group not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold">{group.name}</h1>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={handleShare} variant="outline" className="gap-2">
              <Share className="w-4 h-4" />
              Share Group Link
            </Button>
            <Button
              onClick={() => setShowAddParticipant(true)}
              variant="outline"
              className="gap-2"
            >
              <Users className="w-4 h-4" />
              Add Participant
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">
                ${totalExpenses.toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">Total Expenses</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">
                {group.participants?.length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Participants</div>
            </CardContent>
          </Card>
        </div>

        {/* Participants */}
        {group.participants && group.participants.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Participants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {group.participants.map((participant, index) => (
                  <Badge key={participant.id} variant="secondary" className="px-3 py-1">
                    {participant.name}
                    {index === 0 ? ' (me)' : ''}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add Expense Button */}
        <Card className="border-dashed border-2 border-muted">
          <CardContent className="p-6">
            <Button
              onClick={() => {
                setEditingExpense(null);
                setShowExpenseDialog(true);
              }}
              className="w-full h-12"
              variant="gradient"
              disabled={!group.participants || group.participants.length < 2}
            >
              <Plus className="w-4 h-4" />
              Add Expense
            </Button>
            {(!group.participants || group.participants.length < 2) && (
              <p className="text-sm text-muted-foreground text-center mt-2">
                Add at least 2 participants to start tracking expenses
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent Expenses */}
        {expenses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Expenses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {expenses.map((expense) => {
                const paidByName =
                  group.participants?.find((p) => p.id === expense.paid_by)?.name || 'Unknown';
                return (
                  <div
                    key={expense.id}
                    className="flex justify-between items-center p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{expense.description}</div>
                      <div className="text-sm text-muted-foreground">
                        Paid by {paidByName} • Split {expense.expense_splits.length} ways
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-lg font-semibold text-primary">
                        ${expense.amount.toFixed(2)}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditExpense(expense)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteExpense(expense.id)}
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

        {/* Balances */}
        {expenses.length > 0 && group.participants && (
          <Card>
            <CardHeader>
              <CardTitle>Balances</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {group.participants.map((participant) => {
                const balance = balances[participant.id] || 0;
                const isPositive = balance > 0;
                const isNeutral = Math.abs(balance) < 0.01;

                return (
                  <div key={participant.id} className="flex justify-between items-center">
                    <span className="font-medium">{participant.name}</span>
                    <span
                      className={`font-semibold ${
                        isNeutral
                          ? 'text-muted-foreground'
                          : isPositive
                          ? 'text-success'
                          : 'text-destructive'
                      }`}
                    >
                      {isNeutral
                        ? 'Settled'
                        : isPositive
                        ? `Gets $${balance.toFixed(2)}`
                        : `Owes $${Math.abs(balance).toFixed(2)}`}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      <AddParticipantDialog
        open={showAddParticipant}
        onOpenChange={setShowAddParticipant}
        onAddParticipant={addParticipant}
      />

      <ExpenseDialog
        open={showExpenseDialog}
        onOpenChange={(open) => {
          setShowExpenseDialog(open);
          if (!open) setEditingExpense(null);
        }}
        onSave={handleSaveExpense}
        participants={group.participants || []}
        expense={editingExpense}
        isEditing={!!editingExpense}
      />
    </div>
  );
}
