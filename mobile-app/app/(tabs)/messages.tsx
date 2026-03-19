import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Platform,
  SafeAreaView, Alert, Modal, TextInput, ActivityIndicator, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../components/AppHeader";
import { useFeatureFlags } from "../../contexts/FeatureFlagsContext";
import { BASE_URL } from "../../config";

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

  const isStaff = myRole === "educator" || myRole === "admin";
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
    const confirmed = Platform.OS==="web" ? window.confirm("Permanently delete this conversation?") : await new Promise<boolean>(r=>Alert.alert("Delete","This cannot be undone.",[{text:"Cancel",onPress:()=>r(false)},{text:"Delete",style:"destructive",onPress:()=>r(true)}]));
    if(!confirmed)return; const t = await getToken(); await fetch(`${BASE_URL}/api/messages/conversations/${id}`,{method:"DELETE",headers:{Authorization:`Bearer ${t}`}}); fetchConversations(); fetchArchived();
  };

  const startDirectMessage = async (otherUserId: number) => {
    try { const t = await getToken(); const r = await fetch(`${BASE_URL}/api/messages/conversations/direct`,{method:"POST",headers:{Authorization:`Bearer ${t}`,"Content-Type":"application/json"},body:JSON.stringify({other_user_id:otherUserId})}); const d = await r.json(); if(r.ok){setModalVisible(false);setUserSearch("");router.push(`/chat/${d.conversation_id}` as any);}} catch(e){Alert.alert("Error","Could not start conversation");}
  };

  const createGroupChat = async () => {
    if(!groupName.trim())return Alert.alert("Please enter a group name");
    if(selectedUsers.length===0)return Alert.alert("Please select at least one participant");
    try { const t = await getToken(); const r = await fetch(`${BASE_URL}/api/messages/conversations/group`,{method:"POST",headers:{Authorization:`Bearer ${t}`,"Content-Type":"application/json"},body:JSON.stringify({name:groupName,participant_ids:selectedUsers})}); const d = await r.json(); if(r.ok){setGroupModalVisible(false);setGroupName("");setSelectedUsers([]);fetchConversations();router.push(`/chat/${d.conversation_id}` as any);}} catch(e){Alert.alert("Error","Could not create group");}
  };

  // broadcast — sends targeting based on which mode was picked
  const handleBroadcast = async () => {
    if(broadcastTargetMode==="group"&&!broadcastGroup) return Alert.alert("Please select a student group");
    if(broadcastTargetMode==="course"&&!broadcastProgramme) return Alert.alert("Please select a course");
    if(!broadcastMessage.trim()) return Alert.alert("Please enter a message");
    setBroadcasting(true);
    try {
      const t = await getToken();
      const body: any = { message: broadcastMessage };
      if(broadcastTargetMode==="group") body.student_group = broadcastGroup;
      else if(broadcastTargetMode==="course") body.student_group = broadcastProgramme; // reuse field for now
      else body.student_group = "all";

      const r = await fetch(`${BASE_URL}/api/messages/conversations/broadcast`,{method:"POST",headers:{Authorization:`Bearer ${t}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
      const d = await r.json();
      if(r.ok){setBroadcastModalVisible(false);setBroadcastGroup("");setBroadcastProgramme("");setBroadcastMessage("");setBroadcastTargetMode("group");fetchConversations();Alert.alert("Broadcast Sent",`Message sent to ${d.sent_to} learner(s).`);}
      else Alert.alert("Error",d.error||"Broadcast failed");
    } catch(e){Alert.alert("Error","Could not broadcast message");} finally{setBroadcasting(false);}
  };

  const toggleUserSelection = (userId: number) => setSelectedUsers(p=>p.includes(userId)?p.filter(id=>id!==userId):[...p,userId]);
  const filteredUsers = allUsers.filter(u=>u.email.toLowerCase().includes(userSearch.toLowerCase()));
  const getConversationTitle = (c: Conversation): string => { if(c.is_group)return c.name||"Group Chat"; if(c.is_broadcast&&c.name)return c.name; return c.other_user_email||"Unknown"; };

  const renderConversationRow = (item: Conversation, isArchived: boolean) => (
    <View style={styles.conversationRow}>
      <TouchableOpacity style={styles.conversationPressable} onPress={()=>router.push(`/chat/${item.id}` as any)}>
        <View style={[styles.avatar, item.is_group&&styles.avatarGroup, item.is_broadcast&&styles.avatarBroadcast]}>
          <Ionicons name={item.is_broadcast?"megaphone":item.is_group?"people":"person"} size={20} color="#fff"/>
        </View>
        <View style={styles.conversationInfo}>
          <View style={styles.conversationTop}>
            <Text style={styles.conversationName} numberOfLines={1}>{getConversationTitle(item)}</Text>
            <Text style={styles.timeText}>{formatTime(item.last_message_at)}</Text>
          </View>
          <Text style={styles.lastMessage} numberOfLines={1}>{item.last_message||"No messages yet"}</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.rowActions}>
        {isArchived?(<TouchableOpacity style={styles.restoreBtn} onPress={()=>handleUnarchive(item.id)}><Ionicons name="arrow-undo-outline" size={18} color="#2563eb"/></TouchableOpacity>):(<TouchableOpacity style={styles.archiveBtn} onPress={()=>handleArchive(item.id)}><Ionicons name="archive-outline" size={18} color="#f59e0b"/></TouchableOpacity>)}
        <TouchableOpacity style={styles.deleteBtn} onPress={()=>handleDelete(item.id)}><Ionicons name="trash-outline" size={18} color="#ef4444"/></TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader />
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerActions}>
          {isStaff&&(<TouchableOpacity style={styles.iconButton} onPress={()=>setBroadcastModalVisible(true)}><Ionicons name="megaphone-outline" size={22} color="#f59e0b"/></TouchableOpacity>)}
          {groupChatEnabled&&(<TouchableOpacity style={styles.iconButton} onPress={()=>{fetchAllUsers();setGroupModalVisible(true);}}><Ionicons name="people-outline" size={22} color="#2563eb"/></TouchableOpacity>)}
          <TouchableOpacity style={styles.iconButton} onPress={()=>{fetchAllUsers();setModalVisible(true);}}><Ionicons name="create-outline" size={22} color="#2563eb"/></TouchableOpacity>
        </View>
      </View>

      {loading?(<ActivityIndicator style={{marginTop:40}} size="large" color="#2563eb"/>):(
        <FlatList data={conversations} keyExtractor={i=>i.id.toString()} renderItem={({item})=>renderConversationRow(item,false)} contentContainerStyle={styles.listContent}
          ListEmptyComponent={<View style={styles.emptyState}><Ionicons name="chatbubbles-outline" size={60} color="#ccc"/><Text style={styles.emptyText}>No conversations yet</Text><Text style={styles.emptySubText}>Tap the pencil icon to start a new message</Text></View>}
          ListFooterComponent={archivedConversations.length>0?(<View style={styles.archivedSection}><TouchableOpacity style={styles.archivedToggle} onPress={()=>setShowArchived(!showArchived)}><Ionicons name="archive-outline" size={18} color="#6b7280"/><Text style={styles.archivedToggleText}>Cleared Messages ({archivedConversations.length})</Text><Ionicons name={showArchived?"chevron-up":"chevron-down"} size={18} color="#6b7280"/></TouchableOpacity>{showArchived&&archivedConversations.map(c=><View key={c.id} style={styles.archivedRow}>{renderConversationRow(c,true)}</View>)}</View>):null}
        />
      )}

      {/* ══════ BROADCAST MODAL — with Everyone/Group/Course picker ══════ */}
      <Modal visible={broadcastModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setBroadcastModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Broadcast Message</Text>
            <TouchableOpacity onPress={()=>setBroadcastModalVisible(false)}><Ionicons name="close" size={24} color="#333"/></TouchableOpacity>
          </View>
          <ScrollView style={{padding:16}}>
            {/* targeting mode */}
            <Text style={styles.broadcastLabel}>Send To</Text>
            <View style={styles.targetModeRow}>
              <TouchableOpacity style={[styles.targetChip, broadcastTargetMode==="group"&&styles.targetChipActive]} onPress={()=>{setBroadcastTargetMode("group");setBroadcastProgramme("");setShowBroadcastCourseSuggestions(false);}}>
                <Text style={[styles.targetChipText, broadcastTargetMode==="group"&&{color:"#fff"}]}>Student Group</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.targetChip, broadcastTargetMode==="course"&&styles.targetChipActive]} onPress={()=>{setBroadcastTargetMode("course");setBroadcastGroup("");}}>
                <Text style={[styles.targetChipText, broadcastTargetMode==="course"&&{color:"#fff"}]}>Specific Course</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.targetChip, broadcastTargetMode==="all"&&styles.targetChipActive]} onPress={()=>{setBroadcastTargetMode("all");setBroadcastGroup("");setBroadcastProgramme("");setShowBroadcastCourseSuggestions(false);}}>
                <Text style={[styles.targetChipText, broadcastTargetMode==="all"&&{color:"#fff"}]}>Everyone</Text>
              </TouchableOpacity>
            </View>

            {/* group picker */}
            {broadcastTargetMode==="group"&&(
              <View style={styles.broadcastGroupGrid}>{STUDENT_GROUPS.map(g=>(<TouchableOpacity key={g} style={[styles.broadcastGroupChip, broadcastGroup===g&&styles.broadcastGroupChipActive]} onPress={()=>setBroadcastGroup(g)}><Text style={[styles.broadcastGroupChipText, broadcastGroup===g&&styles.broadcastGroupChipTextActive]}>{g}</Text></TouchableOpacity>))}</View>
            )}

            {/* course search */}
            {broadcastTargetMode==="course"&&(<>
              <TextInput style={styles.searchInput} placeholder="Search for a course name..." value={broadcastProgramme} onChangeText={v=>{setBroadcastProgramme(v);setShowBroadcastCourseSuggestions(v.length>0);}} autoCapitalize="none"/>
              {showBroadcastCourseSuggestions&&broadcastCourseSuggestions.length>0&&(
                <View style={styles.suggestionsBox}><ScrollView style={{maxHeight:120}}>{broadcastCourseSuggestions.slice(0,6).map(p=>(<TouchableOpacity key={p} style={styles.suggestionRow} onPress={()=>{setBroadcastProgramme(p);setShowBroadcastCourseSuggestions(false);}}><Text style={styles.suggestionText} numberOfLines={1}>{p}</Text></TouchableOpacity>))}</ScrollView></View>
              )}
            </>)}

            <Text style={[styles.broadcastLabel,{marginTop:16}]}>Message</Text>
            <TextInput style={[styles.searchInput,{height:100,textAlignVertical:"top",margin:0}]} placeholder="Type your message..." value={broadcastMessage} onChangeText={setBroadcastMessage} multiline/>
            <Text style={styles.broadcastNote}>This will send a one-way message to each learner individually. Students cannot reply.</Text>
            <TouchableOpacity style={[styles.createButton, broadcasting&&{opacity:0.6}]} onPress={handleBroadcast} disabled={broadcasting}><Text style={styles.createButtonText}>{broadcasting?"Sending...":"Send Broadcast"}</Text></TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ══════ NEW DM MODAL ══════ */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>New Message</Text><TouchableOpacity onPress={()=>{setModalVisible(false);setUserSearch("");}}><Ionicons name="close" size={24} color="#333"/></TouchableOpacity></View>
          <TextInput style={styles.searchInput} placeholder="Search by email..." value={userSearch} onChangeText={setUserSearch} autoCapitalize="none"/>
          {modalLoading?(<ActivityIndicator style={{marginTop:20}}/>):(
            <FlatList data={filteredUsers} keyExtractor={i=>i.id.toString()} renderItem={({item})=>(<TouchableOpacity style={styles.userRow} onPress={()=>startDirectMessage(item.id)}><View style={styles.userAvatar}><Ionicons name="person" size={16} color="#fff"/></View><View><Text style={styles.userEmail}>{item.email}</Text><Text style={styles.userRole}>{item.role}</Text></View></TouchableOpacity>)}/>
          )}
        </SafeAreaView>
      </Modal>

      {/* ══════ GROUP CHAT MODAL ══════ */}
      <Modal visible={groupModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setGroupModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>New Group Chat</Text><TouchableOpacity onPress={()=>{setGroupModalVisible(false);setGroupName("");setSelectedUsers([]);setUserSearch("");}}><Ionicons name="close" size={24} color="#333"/></TouchableOpacity></View>
          <TextInput style={styles.searchInput} placeholder="Group name..." value={groupName} onChangeText={setGroupName}/>
          <TextInput style={styles.searchInput} placeholder="Search users by email..." value={userSearch} onChangeText={setUserSearch} autoCapitalize="none"/>
          {selectedUsers.length>0&&<Text style={styles.sectionLabel}>{selectedUsers.length} selected</Text>}
          {modalLoading?(<ActivityIndicator style={{marginTop:20}}/>):(
            <FlatList data={filteredUsers} keyExtractor={i=>i.id.toString()} renderItem={({item})=>{const sel=selectedUsers.includes(item.id);return(<TouchableOpacity style={[styles.userRow, sel&&styles.userRowSelected]} onPress={()=>toggleUserSelection(item.id)}><View style={[styles.userAvatar, sel&&styles.userAvatarSelected]}><Ionicons name={sel?"checkmark":"person"} size={16} color="#fff"/></View><View><Text style={styles.userEmail}>{item.email}</Text><Text style={styles.userRole}>{item.role}</Text></View></TouchableOpacity>);}}/>
          )}
          <TouchableOpacity style={styles.createButton} onPress={createGroupChat}><Text style={styles.createButtonText}>Create Group</Text></TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:{flex:1,backgroundColor:"#f4f6f8"}, listContent:{paddingBottom:20},
  headerBar:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:16,paddingVertical:12,backgroundColor:"#fff",borderBottomWidth:1,borderBottomColor:"#eee"},
  headerTitle:{fontSize:20,fontWeight:"700"}, headerActions:{flexDirection:"row",gap:12}, iconButton:{padding:4},
  emptyState:{flex:1,justifyContent:"center",alignItems:"center",padding:40}, emptyText:{fontSize:18,fontWeight:"600",color:"#999",marginTop:16}, emptySubText:{fontSize:14,color:"#bbb",marginTop:8,textAlign:"center"},
  conversationRow:{flexDirection:"row",alignItems:"center",backgroundColor:"#fff",borderBottomWidth:1,borderBottomColor:"#f0f0f0"},
  conversationPressable:{flex:1,flexDirection:"row",alignItems:"center",paddingLeft:16,paddingVertical:14},
  avatar:{width:46,height:46,borderRadius:23,backgroundColor:"#2563eb",justifyContent:"center",alignItems:"center",marginRight:12}, avatarGroup:{backgroundColor:"#7c3aed"}, avatarBroadcast:{backgroundColor:"#f59e0b"},
  conversationInfo:{flex:1}, conversationTop:{flexDirection:"row",justifyContent:"space-between",marginBottom:4}, conversationName:{fontSize:15,fontWeight:"600",flex:1,marginRight:8}, timeText:{fontSize:12,color:"#999"}, lastMessage:{fontSize:13,color:"#666"},
  archivedSection:{marginTop:16,borderTopWidth:1,borderTopColor:"#e5e7eb"}, archivedToggle:{flexDirection:"row",alignItems:"center",paddingHorizontal:16,paddingVertical:14,gap:8,backgroundColor:"#f9fafb"}, archivedToggleText:{flex:1,fontSize:14,fontWeight:"600",color:"#6b7280"}, archivedRow:{opacity:0.7},
  rowActions:{flexDirection:"row",alignItems:"center",paddingRight:8,gap:2}, archiveBtn:{padding:10,borderRadius:20}, restoreBtn:{padding:10,borderRadius:20}, deleteBtn:{padding:10,borderRadius:20},
  modalContainer:{flex:1,backgroundColor:"#fff"}, modalHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",padding:16,borderBottomWidth:1,borderBottomColor:"#eee"}, modalTitle:{fontSize:18,fontWeight:"700"},
  searchInput:{margin:16,padding:12,borderWidth:1,borderColor:"#ddd",borderRadius:12,fontSize:15}, sectionLabel:{paddingHorizontal:16,fontWeight:"600",color:"#555",marginBottom:8},
  userRow:{flexDirection:"row",alignItems:"center",padding:14,borderBottomWidth:1,borderBottomColor:"#f0f0f0"}, userRowSelected:{backgroundColor:"#eff6ff"},
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