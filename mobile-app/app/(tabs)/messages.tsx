/**
 * Messages tab — direct messages, group chats, and broadcast messages.
 * All users can start 1-to-1 conversations and, if the group_chat feature
 * flag is enabled, create named group chats.
 * Educators and admins can send a broadcast (one-way message) to a student
 * group, a specific course, or everyone. Conversations can be archived or deleted.
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Platform,
  SafeAreaView, Modal, TextInput, ActivityIndicator, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../components/AppHeader";
import { useFeatureFlags } from "../../contexts/FeatureFlagsContext";
import { useToast } from "../../components/Toast";
import { BASE_URL } from "../../config";
import { useAccessibility } from "../../contexts/AccessibilityContext";

// Shape of a conversation row returned by the API (includes DMs, group chats, and broadcasts)
interface Conversation { id: number; name: string|null; is_group: boolean; is_broadcast: boolean; last_message: string|null; last_message_at: string|null; other_user_email: string|null; archived_at?: string|null; }
interface User { id: number; email: string; role: string; }
interface TokenPayload { id: number; email: string; role: string; }
type TargetMode = "all" | "group" | "course";

const STUDENT_GROUPS = ["Ireland-Midlands","Ireland-SUSI","SB+","Middle East","India","China"];

const getToken = async (): Promise<string|null> => Platform.OS === "web" ? localStorage.getItem("token") : SecureStore.getItemAsync("token");
const formatTime = (dateStr: string|null): string => {
  if (!dateStr) return "";
  const date = new Date(dateStr); const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  return date.toLocaleDateString([],{day:"2-digit",month:"short"});
};

export default function MessagesScreen() {
  const router = useRouter();
  const { isEnabled } = useFeatureFlags();
  const { showToast, confirm } = useToast();
  const { colors, speak, t } = useAccessibility();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [myEmail, setMyEmail] = useState(""); const [myRole, setMyRole] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  // new DM modal
  const [modalVisible, setModalVisible] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [modalLoading, setModalLoading] = useState(false);

  // group chat modal
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);

  // broadcast modal — now with mutually exclusive targeting
  const [broadcastModalVisible, setBroadcastModalVisible] = useState(false);
  const [broadcastTargetMode, setBroadcastTargetMode] = useState<TargetMode>("group");
  const [broadcastGroup, setBroadcastGroup] = useState("");
  const [broadcastProgramme, setBroadcastProgramme] = useState("");
  const [showBroadcastCourseSuggestions, setShowBroadcastCourseSuggestions] = useState(false);
  const [programmeNames, setProgrammeNames] = useState<string[]>([]);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);

  useEffect(() => {
    const init = async () => { const t = await getToken(); if(!t)return; const d=jwtDecode<TokenPayload>(t); setMyEmail(d.email); setMyRole(d.role); };
    init();
  }, []);

  // fetch programme names for course targeting autocomplete
  useEffect(() => {
    const fetchProgrammes = async () => {
      try { const t = await getToken(); const r = await fetch(`${BASE_URL}/api/resources/programmes`,{headers:{Authorization:`Bearer ${t}`}}); if(r.ok) setProgrammeNames(await r.json()); } catch(e){console.error(e);}
    }; fetchProgrammes();
  }, []);

  const broadcastCourseSuggestions = programmeNames.filter(p => broadcastProgramme && p.toLowerCase().includes(broadcastProgramme.toLowerCase()));

  // Only educators and admins can send broadcast messages
  const isStaff = myRole === "educator" || myRole === "admin";
  // Group chat is only shown if the feature flag is turned on in the database
  const groupChatEnabled = isEnabled("group_chat");

  const fetchConversations = useCallback(async () => {
    try { const t = await getToken(); const r = await fetch(`${BASE_URL}/api/messages/conversations`,{headers:{Authorization:`Bearer ${t}`}}); const d = await r.json(); if(r.ok) setConversations(d); } catch(e){console.error(e);} finally{setLoading(false);}
  }, []);

  const fetchArchived = useCallback(async () => {
    try { const t = await getToken(); const r = await fetch(`${BASE_URL}/api/messages/conversations/archived`,{headers:{Authorization:`Bearer ${t}`}}); const d = await r.json(); if(r.ok) setArchivedConversations(d); } catch(e){console.error(e);}
  }, []);

  useEffect(() => { fetchConversations(); fetchArchived(); }, [fetchConversations, fetchArchived]);

  const fetchAllUsers = async () => {
    setModalLoading(true);
    try { const t = await getToken(); const r = await fetch(`${BASE_URL}/api/messages/users`,{headers:{Authorization:`Bearer ${t}`}}); const d = await r.json(); if(r.ok) setAllUsers(d); } catch(e){console.error(e);} finally{setModalLoading(false);}
  };

  const handleArchive = async (id: number) => { const t = await getToken(); await fetch(`${BASE_URL}/api/messages/conversations/${id}/archive`,{method:"PUT",headers:{Authorization:`Bearer ${t}`}}); fetchConversations(); fetchArchived(); };
  const handleUnarchive = async (id: number) => { const t = await getToken(); await fetch(`${BASE_URL}/api/messages/conversations/${id}/unarchive`,{method:"PUT",headers:{Authorization:`Bearer ${t}`}}); fetchConversations(); fetchArchived(); };
  const handleDelete = async (id: number) => {
    const confirmed = await confirm("Permanently delete this conversation?", { title: "Delete", confirmText: "Delete", danger: true });
    if(!confirmed)return; const t = await getToken(); await fetch(`${BASE_URL}/api/messages/conversations/${id}`,{method:"DELETE",headers:{Authorization:`Bearer ${t}`}}); fetchConversations(); fetchArchived(); showToast("Conversation deleted", "success");
  };

  const startDirectMessage = async (otherUserId: number) => {
    try { const t = await getToken(); const r = await fetch(`${BASE_URL}/api/messages/conversations/direct`,{method:"POST",headers:{Authorization:`Bearer ${t}`,"Content-Type":"application/json"},body:JSON.stringify({other_user_id:otherUserId})}); const d = await r.json(); if(r.ok){setModalVisible(false);setUserSearch("");router.push(`/chat/${d.conversation_id}` as any);}} catch(e){showToast("Could not start conversation", "error", "Error");}
  };

  const createGroupChat = async () => {
    if(!groupName.trim()){showToast("Please enter a group name", "warning"); return;}
    if(selectedUsers.length===0){showToast("Please select at least one participant", "warning"); return;}
    try { const t = await getToken(); const r = await fetch(`${BASE_URL}/api/messages/conversations/group`,{method:"POST",headers:{Authorization:`Bearer ${t}`,"Content-Type":"application/json"},body:JSON.stringify({name:groupName,participant_ids:selectedUsers})}); const d = await r.json(); if(r.ok){setGroupModalVisible(false);setGroupName("");setSelectedUsers([]);fetchConversations();router.push(`/chat/${d.conversation_id}` as any);}} catch(e){showToast("Could not create group", "error", "Error");}
  };

  // broadcast — sends targeting based on which mode was picked
  const handleBroadcast = async () => {
    if(broadcastTargetMode==="group"&&!broadcastGroup) {showToast("Please select a student group", "warning"); return;}
    if(broadcastTargetMode==="course"&&!broadcastProgramme) {showToast("Please select a course", "warning"); return;}
    if(!broadcastMessage.trim()) {showToast("Please enter a message", "warning"); return;}
    setBroadcasting(true);
    try {
      const t = await getToken();
      const body: any = { message: broadcastMessage };
      if(broadcastTargetMode==="group") body.student_group = broadcastGroup;
      else if(broadcastTargetMode==="course") body.student_group = broadcastProgramme; // reuse field for now
      else body.student_group = "all";

      const r = await fetch(`${BASE_URL}/api/messages/conversations/broadcast`,{method:"POST",headers:{Authorization:`Bearer ${t}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
      const d = await r.json();
      if(r.ok){setBroadcastModalVisible(false);setBroadcastGroup("");setBroadcastProgramme("");setBroadcastMessage("");setBroadcastTargetMode("group");fetchConversations();showToast(`Message sent to ${d.sent_to} learner(s).`, "success", "Broadcast Sent");}
      else showToast(d.error||"Broadcast failed", "error", "Error");
    } catch(e){showToast("Could not broadcast message", "error", "Error");} finally{setBroadcasting(false);}
  };

  const toggleUserSelection = (userId: number) => setSelectedUsers(p=>p.includes(userId)?p.filter(id=>id!==userId):[...p,userId]);
  const filteredUsers = allUsers.filter(u=>u.email.toLowerCase().includes(userSearch.toLowerCase()));
  const getConversationTitle = (c: Conversation): string => { if(c.is_group)return c.name||"Group Chat"; if(c.is_broadcast&&c.name)return c.name; return c.other_user_email||"Unknown"; };

  const renderConversationRow = (item: Conversation, isArchived: boolean) => (
    <View style={[styles.conversationRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <TouchableOpacity style={styles.conversationPressable} onPress={()=>{ speak(`${getConversationTitle(item)}. ${item.last_message||"No messages yet"}`); router.push(`/chat/${item.id}` as any); }}>
        <View style={[styles.avatar, item.is_group&&styles.avatarGroup, item.is_broadcast&&styles.avatarBroadcast]}>
          <Ionicons name={item.is_broadcast?"megaphone":item.is_group?"people":"person"} size={20} color="#fff"/>
        </View>
        <View style={styles.conversationInfo}>
          <View style={styles.conversationTop}>
            <Text style={[styles.conversationName, { color: colors.text }]} numberOfLines={1}>{getConversationTitle(item)}</Text>
            <Text style={[styles.timeText, { color: colors.textMuted }]}>{formatTime(item.last_message_at)}</Text>
          </View>
          <Text style={[styles.lastMessage, { color: colors.textSecondary }]} numberOfLines={1}>{item.last_message||"No messages yet"}</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.rowActions}>
        {isArchived?(<TouchableOpacity style={styles.restoreBtn} onPress={()=>handleUnarchive(item.id)}><Ionicons name="arrow-undo-outline" size={18} color="#2563eb"/></TouchableOpacity>):(<TouchableOpacity style={styles.archiveBtn} onPress={()=>handleArchive(item.id)}><Ionicons name="archive-outline" size={18} color="#f59e0b"/></TouchableOpacity>)}
        <TouchableOpacity style={styles.deleteBtn} onPress={()=>handleDelete(item.id)}><Ionicons name="trash-outline" size={18} color="#ef4444"/></TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <AppHeader />
      <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("messages_title")}</Text>
        <View style={styles.headerActions}>
          {isStaff&&(<TouchableOpacity style={styles.iconButton} onPress={()=>setBroadcastModalVisible(true)}><Ionicons name="megaphone-outline" size={22} color="#f59e0b"/></TouchableOpacity>)}
          {groupChatEnabled&&(<TouchableOpacity style={styles.iconButton} onPress={()=>{fetchAllUsers();setGroupModalVisible(true);}}><Ionicons name="people-outline" size={22} color="#2563eb"/></TouchableOpacity>)}
          <TouchableOpacity style={styles.iconButton} onPress={()=>{fetchAllUsers();setModalVisible(true);}}><Ionicons name="create-outline" size={22} color="#2563eb"/></TouchableOpacity>
        </View>
      </View>

      {loading?(<ActivityIndicator style={{marginTop:40}} size="large" color="#2563eb"/>):(
        <FlatList data={conversations} keyExtractor={i=>i.id.toString()} renderItem={({item})=>renderConversationRow(item,false)} contentContainerStyle={styles.listContent}
          ListEmptyComponent={<View style={styles.emptyState}><Ionicons name="chatbubbles-outline" size={60} color={colors.border}/><Text style={[styles.emptyText,{color:colors.textMuted}]}>{t("messages_no_conversations")}</Text><Text style={[styles.emptySubText,{color:colors.textMuted}]}>{t("messages_start_hint")}</Text></View>}
          ListFooterComponent={archivedConversations.length>0?(<View style={[styles.archivedSection,{borderTopColor:colors.border}]}><TouchableOpacity style={[styles.archivedToggle,{backgroundColor:colors.surface}]} onPress={()=>setShowArchived(!showArchived)}><Ionicons name="archive-outline" size={18} color={colors.textMuted}/><Text style={[styles.archivedToggleText,{color:colors.textMuted,flex:1}]}>{t("messages_cleared")} ({archivedConversations.length})</Text><Ionicons name={showArchived?"chevron-up":"chevron-down"} size={18} color={colors.textMuted}/></TouchableOpacity>{showArchived&&archivedConversations.map(c=><View key={c.id} style={styles.archivedRow}>{renderConversationRow(c,true)}</View>)}</View>):null}
        />
      )}

      {/* ══════ BROADCAST MODAL — with Everyone/Group/Course picker ══════ */}
      <Modal visible={broadcastModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setBroadcastModalVisible(false)}>
        <SafeAreaView style={[styles.modalContainer,{backgroundColor:colors.background}]}>
          <View style={[styles.modalHeader,{backgroundColor:colors.surface,borderBottomColor:colors.border}]}>
            <Text style={[styles.modalTitle,{color:colors.text}]}>{t("messages_broadcast")}</Text>
            <TouchableOpacity onPress={()=>setBroadcastModalVisible(false)}><Ionicons name="close" size={24} color={colors.text}/></TouchableOpacity>
          </View>
          <ScrollView style={{padding:16}}>
            {/* targeting mode */}
            <Text style={[styles.broadcastLabel,{color:colors.textMuted}]}>{t("messages_broadcast_select")}</Text>
            <View style={styles.targetModeRow}>
              <TouchableOpacity style={[styles.targetChip,{backgroundColor:colors.surfaceAlt,borderColor:colors.border}, broadcastTargetMode==="group"&&styles.targetChipActive]} onPress={()=>{setBroadcastTargetMode("group");setBroadcastProgramme("");setShowBroadcastCourseSuggestions(false);}}>
                <Text style={[styles.targetChipText,{color:colors.text}, broadcastTargetMode==="group"&&{color:"#fff"}]}>{t("ann_student_group")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.targetChip,{backgroundColor:colors.surfaceAlt,borderColor:colors.border}, broadcastTargetMode==="course"&&styles.targetChipActive]} onPress={()=>{setBroadcastTargetMode("course");setBroadcastGroup("");}}>
                <Text style={[styles.targetChipText,{color:colors.text}, broadcastTargetMode==="course"&&{color:"#fff"}]}>{t("ann_specific_course")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.targetChip,{backgroundColor:colors.surfaceAlt,borderColor:colors.border}, broadcastTargetMode==="all"&&styles.targetChipActive]} onPress={()=>{setBroadcastTargetMode("all");setBroadcastGroup("");setBroadcastProgramme("");setShowBroadcastCourseSuggestions(false);}}>
                <Text style={[styles.targetChipText,{color:colors.text}, broadcastTargetMode==="all"&&{color:"#fff"}]}>{t("ann_everyone")}</Text>
              </TouchableOpacity>
            </View>

            {/* group picker */}
            {broadcastTargetMode==="group"&&(
              <View style={styles.broadcastGroupGrid}>{STUDENT_GROUPS.map(g=>(<TouchableOpacity key={g} style={[styles.broadcastGroupChip,{backgroundColor:colors.surfaceAlt,borderColor:colors.border}, broadcastGroup===g&&styles.broadcastGroupChipActive]} onPress={()=>setBroadcastGroup(g)}><Text style={[styles.broadcastGroupChipText,{color:colors.text}, broadcastGroup===g&&styles.broadcastGroupChipTextActive]}>{g}</Text></TouchableOpacity>))}</View>
            )}

            {/* course search */}
            {broadcastTargetMode==="course"&&(<>
              <TextInput style={[styles.searchInput,{backgroundColor:colors.inputBg,borderColor:colors.inputBorder,color:colors.text}]} placeholder={t("search")} placeholderTextColor={colors.textMuted} value={broadcastProgramme} onChangeText={v=>{setBroadcastProgramme(v);setShowBroadcastCourseSuggestions(v.length>0);}} autoCapitalize="none"/>
              {showBroadcastCourseSuggestions&&broadcastCourseSuggestions.length>0&&(
                <View style={[styles.suggestionsBox,{backgroundColor:colors.surface,borderColor:colors.border}]}><ScrollView style={{maxHeight:120}}>{broadcastCourseSuggestions.slice(0,6).map(p=>(<TouchableOpacity key={p} style={[styles.suggestionRow,{borderBottomColor:colors.border}]} onPress={()=>{setBroadcastProgramme(p);setShowBroadcastCourseSuggestions(false);}}><Text style={[styles.suggestionText,{color:colors.text}]} numberOfLines={1}>{p}</Text></TouchableOpacity>))}</ScrollView></View>
              )}
            </>)}

            <Text style={[styles.broadcastLabel,{marginTop:16,color:colors.textMuted}]}>{t("messages_type_message")}</Text>
            <TextInput style={[styles.searchInput,{height:100,textAlignVertical:"top",margin:0,backgroundColor:colors.inputBg,borderColor:colors.inputBorder,color:colors.text}]} placeholder={t("messages_type_message")} placeholderTextColor={colors.textMuted} value={broadcastMessage} onChangeText={setBroadcastMessage} multiline/>
            <Text style={styles.broadcastNote}>{t("messages_broadcast_note")}</Text>
            <TouchableOpacity style={[styles.createButton,{backgroundColor:colors.primary}, broadcasting&&{opacity:0.6}]} onPress={handleBroadcast} disabled={broadcasting}><Text style={styles.createButtonText}>{broadcasting?t("loading"):t("messages_send_broadcast")}</Text></TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ══════ NEW DM MODAL ══════ */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setModalVisible(false)}>
        <SafeAreaView style={[styles.modalContainer,{backgroundColor:colors.background}]}>
          <View style={[styles.modalHeader,{backgroundColor:colors.surface,borderBottomColor:colors.border}]}><Text style={[styles.modalTitle,{color:colors.text}]}>{t("messages_new")}</Text><TouchableOpacity onPress={()=>{setModalVisible(false);setUserSearch("");}}><Ionicons name="close" size={24} color={colors.text}/></TouchableOpacity></View>
          <TextInput style={[styles.searchInput,{backgroundColor:colors.inputBg,borderColor:colors.inputBorder,color:colors.text}]} placeholder={t("messages_search_email")} placeholderTextColor={colors.textMuted} value={userSearch} onChangeText={setUserSearch} autoCapitalize="none"/>
          {modalLoading?(<ActivityIndicator style={{marginTop:20}} color={colors.primary}/>):(
            <FlatList data={filteredUsers} keyExtractor={i=>i.id.toString()} renderItem={({item})=>(<TouchableOpacity style={[styles.userRow,{borderBottomColor:colors.border}]} onPress={()=>startDirectMessage(item.id)}><View style={styles.userAvatar}><Ionicons name="person" size={16} color="#fff"/></View><View><Text style={[styles.userEmail,{color:colors.text}]}>{item.email}</Text><Text style={[styles.userRole,{color:colors.textMuted}]}>{item.role}</Text></View></TouchableOpacity>)}/>
          )}
        </SafeAreaView>
      </Modal>

      {/* ══════ GROUP CHAT MODAL ══════ */}
      <Modal visible={groupModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setGroupModalVisible(false)}>
        <SafeAreaView style={[styles.modalContainer,{backgroundColor:colors.background}]}>
          <View style={[styles.modalHeader,{backgroundColor:colors.surface,borderBottomColor:colors.border}]}><Text style={[styles.modalTitle,{color:colors.text}]}>{t("msg_group_chat")}</Text><TouchableOpacity onPress={()=>{setGroupModalVisible(false);setGroupName("");setSelectedUsers([]);setUserSearch("");}}><Ionicons name="close" size={24} color={colors.text}/></TouchableOpacity></View>
          <TextInput style={[styles.searchInput,{backgroundColor:colors.inputBg,borderColor:colors.inputBorder,color:colors.text}]} placeholder={t("msg_group_name")} placeholderTextColor={colors.textMuted} value={groupName} onChangeText={setGroupName}/>
          <TextInput style={[styles.searchInput,{backgroundColor:colors.inputBg,borderColor:colors.inputBorder,color:colors.text}]} placeholder={t("messages_search_email")} placeholderTextColor={colors.textMuted} value={userSearch} onChangeText={setUserSearch} autoCapitalize="none"/>
          {selectedUsers.length>0&&<Text style={[styles.sectionLabel,{color:colors.textMuted}]}>{selectedUsers.length} {t("msg_selected")}</Text>}
          {modalLoading?(<ActivityIndicator style={{marginTop:20}} color={colors.primary}/>):(
            <FlatList data={filteredUsers} keyExtractor={i=>i.id.toString()} renderItem={({item})=>{const sel=selectedUsers.includes(item.id);return(<TouchableOpacity style={[styles.userRow,{borderBottomColor:colors.border,backgroundColor:sel?colors.primaryLight:"transparent"}]} onPress={()=>toggleUserSelection(item.id)}><View style={[styles.userAvatar, sel&&styles.userAvatarSelected]}><Ionicons name={sel?"checkmark":"person"} size={16} color="#fff"/></View><View><Text style={[styles.userEmail,{color:colors.text}]}>{item.email}</Text><Text style={[styles.userRole,{color:colors.textMuted}]}>{item.role}</Text></View></TouchableOpacity>);}}/>
          )}
          <TouchableOpacity style={[styles.createButton,{backgroundColor:colors.primary}]} onPress={createGroupChat}><Text style={styles.createButtonText}>{t("msg_create_group")}</Text></TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:{flex:1}, listContent:{paddingBottom:20},
  headerBar:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:16,paddingVertical:12,backgroundColor:"#fff",borderBottomWidth:1,borderBottomColor:"#eee"},
  headerTitle:{fontSize:20,fontWeight:"700"}, headerActions:{flexDirection:"row",gap:12}, iconButton:{padding:4},
  emptyState:{flex:1,justifyContent:"center",alignItems:"center",padding:40}, emptyText:{fontSize:18,fontWeight:"600",color:"#999",marginTop:16}, emptySubText:{fontSize:14,color:"#bbb",marginTop:8,textAlign:"center"},
  conversationRow:{flexDirection:"row",alignItems:"center",backgroundColor:"#fff",borderBottomWidth:1,borderBottomColor:"#f0f0f0"},
  conversationPressable:{flex:1,flexDirection:"row",alignItems:"center",paddingLeft:16,paddingVertical:14},
  avatar:{width:46,height:46,borderRadius:23,backgroundColor:"#2563eb",justifyContent:"center",alignItems:"center",marginRight:12}, avatarGroup:{backgroundColor:"#7c3aed"}, avatarBroadcast:{backgroundColor:"#f59e0b"},
  conversationInfo:{flex:1}, conversationTop:{flexDirection:"row",justifyContent:"space-between",marginBottom:4}, conversationName:{fontSize:15,fontWeight:"600",flex:1,marginRight:8}, timeText:{fontSize:12,color:"#999"}, lastMessage:{fontSize:13,color:"#666"},
  archivedSection:{marginTop:16,borderTopWidth:1,borderTopColor:"#e5e7eb"}, archivedToggle:{flexDirection:"row",alignItems:"center",paddingHorizontal:16,paddingVertical:14,gap:8,backgroundColor:"#f9fafb"}, archivedToggleText:{flex:1,fontSize:14,fontWeight:"600",color:"#6b7280"}, archivedRow:{opacity:0.7},
  rowActions:{flexDirection:"row",alignItems:"center",paddingRight:8,gap:2}, archiveBtn:{padding:10,borderRadius:20}, restoreBtn:{padding:10,borderRadius:20}, deleteBtn:{padding:10,borderRadius:20},
  modalContainer:{flex:1}, modalHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",padding:16,borderBottomWidth:1},
  modalTitle:{fontSize:18,fontWeight:"700"},
  searchInput:{margin:16,padding:12,borderWidth:1,borderRadius:12,fontSize:15}, sectionLabel:{paddingHorizontal:16,fontWeight:"600",marginBottom:8},
  userRow:{flexDirection:"row",alignItems:"center",padding:14,borderBottomWidth:1}, userRowSelected:{},
  userAvatar:{width:38,height:38,borderRadius:19,backgroundColor:"#2563eb",justifyContent:"center",alignItems:"center",marginRight:12}, userAvatarSelected:{backgroundColor:"#16a34a"},
  userEmail:{fontSize:15,fontWeight:"500"}, userRole:{fontSize:12,color:"#888",marginTop:2},
  createButton:{margin:16,backgroundColor:"#2563eb",padding:14,borderRadius:12,alignItems:"center"}, createButtonText:{color:"#fff",fontWeight:"700",fontSize:15},

  // broadcast modal targeting
  broadcastLabel:{fontSize:14,fontWeight:"600",color:"#374151",marginBottom:10},
  targetModeRow:{flexDirection:"row",flexWrap:"wrap",gap:8,marginBottom:12},
  targetChip:{paddingHorizontal:14,paddingVertical:8,borderRadius:20,borderWidth:1,borderColor:"#ddd",backgroundColor:"#f9fafb"},
  targetChipActive:{backgroundColor:"#2563eb",borderColor:"#2563eb"},
  targetChipText:{fontSize:13,fontWeight:"600",color:"#374151"},
  broadcastGroupGrid:{flexDirection:"row",flexWrap:"wrap",gap:8,marginBottom:8},
  broadcastGroupChip:{paddingHorizontal:14,paddingVertical:10,borderRadius:12,borderWidth:1,borderColor:"#d1d5db",backgroundColor:"#f9fafb"},
  broadcastGroupChipActive:{backgroundColor:"#2563eb",borderColor:"#2563eb"},
  broadcastGroupChipText:{fontSize:13,fontWeight:"600",color:"#374151"},
  broadcastGroupChipTextActive:{color:"#fff"},
  suggestionsBox:{backgroundColor:"#fff",borderRadius:10,borderWidth:1,borderColor:"#e5e7eb",marginHorizontal:16,marginBottom:8},
  suggestionRow:{paddingHorizontal:14,paddingVertical:10,borderBottomWidth:1,borderBottomColor:"#f3f4f6"},
  suggestionText:{fontSize:13,color:"#374151"},
  broadcastNote:{fontSize:12,color:"#92400e",backgroundColor:"#fef3c7",padding:10,borderRadius:8,marginTop:12,marginBottom:4},
});