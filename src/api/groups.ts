import { supabase } from '@/integrations/supabase/client';
import { GroupWithParticipants } from '@/types/group';

export async function createGroup(name: string, description?: string) {
  return await supabase
    .from('group')
    .insert([{ name, description }])
    .select()
    .single();
}

export async function getGroupById(groupId: string) {
  return await supabase
    .from('group')
    .select(
      'id, name, participants(id, name, group_id, created_at), description, created_at'
    )
    .eq('id', groupId)
    .single();
}
