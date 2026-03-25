import React, { useEffect, useState } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  Platform, SafeAreaView, Alert, ScrollView,
} from "react-native";
import AppHeader from "../../components/AppHeader";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { BASE_URL } from "../../config";

interface Announcement {
  id: number; title: string; content: string; priority: string;
  student_group: string | null; programme_name: string | null;
  created_at: string; read_count: number; created_by: number;
}
interface TokenPayload { id: number; email: string; role: string; }
type TargetMode = "all" | "group" | "course";
const STUDENT_GROUPS = ["Ireland-Midlands", "Ireland-SUSI", "SB+", "Middle East", "India", "China"];

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [role, setRole] = useState(""); const [userId, setUserId] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState(""); const [newContent, setNewContent] = useState("");
  const [priority, setPriority] = useState<"high"|"medium"|"low">("medium");
  const [targetMode, setTargetMode] = useState<TargetMode>("all");
  const [targetGroup, setTargetGroup] = useState(""); const [targetProgramme, setTargetProgramme] = useState("");
  const [showCourseSuggestions, setShowCourseSuggestions] = useState(false);
  const [programmeNames, setProgrammeNames] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<number|null>(null);
  const [editTitle, setEditTitle] = useState(""); const [editContent, setEditContent] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const getToken = async () => Platform.OS === "web" ? localStorage.getItem("token") : await SecureStore.getItemAsync("token");
  const loadUser = async () => { const t = await getToken(); if(!t)return; const d=jwtDecode<TokenPayload>(t); setRole(d.role); setUserId(d.id); };

  // helper for cross-platform alerts
  const showAlert = (title: string, msg?: string) => {
    if (Platform.OS === "web") window.alert(msg ? `${title}: ${msg}` : title);
    else Alert.alert(title, msg);
  };

  useEffect(() => {
    const fetchProgrammes = async () => {
      try { const t = await getToken(); const r = await fetch(`${BASE_URL}/api/resources/programmes`,{headers:{Authorization:`Bearer ${t}`}}); if(r.ok) setProgrammeNames(await r.json()); } catch(e){console.error(e);}
    }; fetchProgrammes();
  }, []);

  const courseSuggestions = programmeNames.filter(p => targetProgramme && p.toLowerCase().includes(targetProgramme.toLowerCase()));

  const fetchAnnouncements = async (groupFilter?: string) => {
    const t = await getToken(); if(!t) return;
    const f = groupFilter ?? activeFilter;
    const q = f && f !== "all" ? `?student_group=${encodeURIComponent(f)}` : "";
    try {
      const r = await fetch(`${BASE_URL}/api/announcements${q}`,{headers:{Authorization:`Bearer ${t}`}});
      if (r.ok) setAnnouncements(await r.json());
    } catch (e) { console.error("Failed to fetch announcements:", e); }
  };

  useEffect(() => { loadUser(); fetchAnnouncements(); }, []);

  const markAsRead = async (id: number) => { const t = await getToken(); if(!t)return; await fetch(`${BASE_URL}/api/announcements/${id}/read`,{method:"POST",headers:{Authorization:`Bearer ${t}`}}); fetchAnnouncements(); };

  // create with proper error handling so we can see what's going wrong on Render
  const handleCreate = async () => {
    if(!newTitle || !newContent) {
      showAlert("Error", "Title and content required");
      return;
    }
    const t = await getToken();
    if(!t) { showAlert("Error", "Not logged in"); return; }

    const body: any = { title: newTitle, content: newContent, priority };
    if (targetMode === "group" && targetGroup) body.student_group = targetGroup;
    else if (targetMode === "course" && targetProgramme) body.programme_name = targetProgramme;

    try {
      const res = await fetch(`${BASE_URL}/api/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        showAlert("Error", err.error || "Failed to create announcement");
        return;
      }

      // success — clear the form and refresh the list
      setNewTitle(""); setNewContent(""); setTargetMode("all"); setTargetGroup(""); setTargetProgramme("");
      setShowCreateForm(false);
      fetchAnnouncements();
    } catch (e) {
      console.error("Create announcement error:", e);
      showAlert("Error", "Could not connect to server");
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = Platform.OS === "web"
      ? window.confirm("Delete this announcement?")
      : await new Promise<boolean>(r => Alert.alert("Delete","Are you sure?",[{text:"Cancel",onPress:()=>r(false)},{text:"Delete",style:"destructive",onPress:()=>r(true)}]));
    if (!confirmed) return;
    const t = await getToken(); if(!t)return;
    await fetch(`${BASE_URL}/api/announcements/${id}`,{method:"DELETE",headers:{Authorization:`Bearer ${t}`}});
    fetchAnnouncements();
  };

  const handleUpdate = async () => {
    if(!editingId) return;
    const t = await getToken(); if(!t)return;
    await fetch(`${BASE_URL}/api/announcements/${editingId}`,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({title:editTitle,content:editContent,priority})});
    setEditingId(null);
    fetchAnnouncements();
  };

  const handleFilterChange = (g: string) => { setActiveFilter(g); fetchAnnouncements(g); };

  const canCreate = role === "educator" || role === "admin";
  const isStaff = role === "educator" || role === "admin";
  const priorityColor = (p: string) => { switch(p){case"high":return"#ef4444";case"low":return"#10b981";default:return"#f59e0b";} };

  const renderItem = ({item}:{item:Announcement}) => {
    const isEditing = editingId===item.id;
    const canModify = isStaff||item.created_by===userId;
    return (
      <TouchableOpacity style={styles.card} onPress={()=>markAsRead(item.id)} activeOpacity={0.8}>
        <View style={[styles.priorityStripe,{backgroundColor:priorityColor(item.priority)}]}/>
        <View style={styles.cardContent}>
          {isEditing?(<><TextInput style={styles.input} value={editTitle} onChangeText={setEditTitle}/><TextInput style={[styles.input,{height:60}]} multiline value={editContent} onChangeText={setEditContent}/><TouchableOpacity style={styles.saveButton} onPress={handleUpdate}><Text style={styles.buttonText}>Save</Text></TouchableOpacity><TouchableOpacity onPress={()=>setEditingId(null)}><Text style={{color:"#999",textAlign:"center",marginTop:6}}>Cancel</Text></TouchableOpacity></>):(
            <>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardBody}>{item.content}</Text>
              <View style={styles.cardMeta}>
                <View style={[styles.priorityBadge,{backgroundColor:priorityColor(item.priority)+"20"}]}><Text style={[styles.priorityBadgeText,{color:priorityColor(item.priority)}]}>{item.priority}</Text></View>
                {item.student_group&&<View style={styles.groupBadge}><Text style={styles.groupBadgeText}>{item.student_group}</Text></View>}
                {item.programme_name&&<View style={styles.courseBadge}><Text style={styles.courseBadgeText}>{item.programme_name}</Text></View>}
                <Text style={styles.readCount}>{item.read_count} read</Text>
                <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
              </View>
              {canModify&&(<View style={styles.cardActions}><TouchableOpacity onPress={()=>{setEditingId(item.id);setEditTitle(item.title);setEditContent(item.content);}}><Text style={styles.editText}>Edit</Text></TouchableOpacity><TouchableOpacity onPress={()=>handleDelete(item.id)}><Text style={styles.deleteText}>Delete</Text></TouchableOpacity></View>)}
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader />

      {/* header with title and create button */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Announcements</Text>
        {canCreate && (
          <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateForm(!showCreateForm)}>
            <Text style={styles.createBtnText}>{showCreateForm ? "Cancel" : "+ New"}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* filter chips for staff */}
      {isStaff && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterBarContent}>
          <TouchableOpacity style={[styles.filterChip, activeFilter==="all"&&styles.filterChipActive]} onPress={()=>handleFilterChange("all")}><Text style={[styles.filterChipText, activeFilter==="all"&&styles.filterChipTextActive]}>All</Text></TouchableOpacity>
          {STUDENT_GROUPS.map(g=>(<TouchableOpacity key={g} style={[styles.filterChip, activeFilter===g&&styles.filterChipActive]} onPress={()=>handleFilterChange(g)}><Text style={[styles.filterChipText, activeFilter===g&&styles.filterChipTextActive]}>{g}</Text></TouchableOpacity>))}
        </ScrollView>
      )}

      {/* create form — OUTSIDE the FlatList so inputs keep focus */}
      {showCreateForm && canCreate && (
        <ScrollView style={styles.createFormScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.createSection}>
            <TextInput placeholder="Title" style={styles.input} value={newTitle} onChangeText={setNewTitle} />
            <TextInput placeholder="Content" style={[styles.input,{height:80}]} multiline value={newContent} onChangeText={setNewContent} />

            <Text style={styles.selectorLabel}>Visible To</Text>
            <View style={styles.targetModeRow}>
              <TouchableOpacity style={[styles.groupChip, targetMode==="all"&&styles.groupChipActive]} onPress={()=>{setTargetMode("all");setTargetGroup("");setTargetProgramme("");setShowCourseSuggestions(false);}}><Text style={[styles.groupChipText, targetMode==="all"&&styles.groupChipTextActive]}>Everyone</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.groupChip, targetMode==="group"&&styles.groupChipActive]} onPress={()=>{setTargetMode("group");setTargetProgramme("");setShowCourseSuggestions(false);}}><Text style={[styles.groupChipText, targetMode==="group"&&styles.groupChipTextActive]}>Student Group</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.groupChip, targetMode==="course"&&styles.groupChipActive]} onPress={()=>{setTargetMode("course");setTargetGroup("");}}><Text style={[styles.groupChipText, targetMode==="course"&&styles.groupChipTextActive]}>Specific Course</Text></TouchableOpacity>
            </View>

            {targetMode==="group"&&(<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupSelector} contentContainerStyle={styles.groupSelectorContent}>{STUDENT_GROUPS.map(g=>(<TouchableOpacity key={g} style={[styles.groupChip, targetGroup===g&&{backgroundColor:"#10b981",borderColor:"#10b981"}]} onPress={()=>setTargetGroup(g)}><Text style={[styles.groupChipText, targetGroup===g&&{color:"#fff"}]}>{g}</Text></TouchableOpacity>))}</ScrollView>)}

            {targetMode==="course"&&(<>
              <TextInput style={[styles.input,{marginBottom:0}]} placeholder="Search for a course name..." value={targetProgramme} onChangeText={v=>{setTargetProgramme(v);setShowCourseSuggestions(v.length>0);}} autoCapitalize="none"/>
              {showCourseSuggestions&&courseSuggestions.length>0&&(<View style={styles.suggestionsBox}><ScrollView style={{maxHeight:120}} keyboardShouldPersistTaps="handled">{courseSuggestions.slice(0,6).map(p=>(<TouchableOpacity key={p} style={styles.suggestionRow} onPress={()=>{setTargetProgramme(p);setShowCourseSuggestions(false);}}><Text style={styles.suggestionText} numberOfLines={1}>{p}</Text></TouchableOpacity>))}</ScrollView></View>)}
            </>)}

            <Text style={[styles.selectorLabel,{marginTop:10}]}>Priority</Text>
            <View style={styles.priorityRow}>
              {(["low","medium","high"] as const).map(p=>(<TouchableOpacity key={p} style={[styles.priorityChip, priority===p&&styles.priorityChipActive, priority===p&&{backgroundColor:priorityColor(p)}]} onPress={()=>setPriority(p)}><Text style={[styles.priorityChipText, priority===p&&styles.priorityChipTextActive]}>{p.charAt(0).toUpperCase()+p.slice(1)}</Text></TouchableOpacity>))}
            </View>

            <TouchableOpacity style={styles.createButton} onPress={handleCreate}><Text style={styles.buttonText}>Publish Announcement</Text></TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* announcement list — only shows when create form is hidden */}
      {!showCreateForm && (
        <FlatList data={announcements} keyExtractor={i=>i.id.toString()} renderItem={renderItem} contentContainerStyle={styles.listContent} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:{flex:1,backgroundColor:"#f4f6f8"},
  listContent:{padding:12,paddingBottom:40},
  headerBar:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:16,paddingVertical:12,backgroundColor:"#fff",borderBottomWidth:1,borderBottomColor:"#eee"},
  headerTitle:{fontSize:20,fontWeight:"700"},
  createBtn:{backgroundColor:"#2563eb",paddingHorizontal:14,paddingVertical:8,borderRadius:20},
  createBtnText:{color:"#fff",fontWeight:"600",fontSize:13},
  filterBar:{flexGrow:0,flexShrink:0,height:48,paddingHorizontal:12,paddingTop:8},
  filterBarContent:{flexDirection:"row",alignItems:"center",gap:8},
  filterChip:{paddingHorizontal:14,paddingVertical:8,borderRadius:20,backgroundColor:"#fff",borderWidth:1,borderColor:"#e5e7eb",flexGrow:0,flexShrink:0},
  filterChipActive:{backgroundColor:"#2563eb",borderColor:"#2563eb"},
  filterChipText:{fontSize:12,fontWeight:"600",color:"#6b7280"},
  filterChipTextActive:{color:"#fff"},
  card:{flexDirection:"row",backgroundColor:"#fff",borderRadius:14,marginBottom:10,overflow:"hidden",shadowColor:"#000",shadowOpacity:0.04,shadowRadius:4,elevation:1},
  priorityStripe:{width:4}, cardContent:{flex:1,padding:14},
  cardTitle:{fontSize:15,fontWeight:"700",color:"#111827",marginBottom:4},
  cardBody:{fontSize:13,color:"#6b7280",lineHeight:18,marginBottom:8},
  cardMeta:{flexDirection:"row",alignItems:"center",flexWrap:"wrap",gap:8},
  priorityBadge:{paddingHorizontal:8,paddingVertical:2,borderRadius:8},
  priorityBadgeText:{fontSize:10,fontWeight:"700",textTransform:"uppercase"},
  groupBadge:{backgroundColor:"#eff6ff",paddingHorizontal:8,paddingVertical:2,borderRadius:8},
  groupBadgeText:{fontSize:10,fontWeight:"600",color:"#2563eb"},
  courseBadge:{backgroundColor:"#f5f3ff",paddingHorizontal:8,paddingVertical:2,borderRadius:8},
  courseBadgeText:{fontSize:10,fontWeight:"500",color:"#8b5cf6"},
  readCount:{fontSize:11,color:"#9ca3af"}, date:{fontSize:11,color:"#9ca3af"},
  cardActions:{flexDirection:"row",gap:16,marginTop:8},
  editText:{color:"#2563eb",fontWeight:"600",fontSize:13},
  deleteText:{color:"#ef4444",fontWeight:"600",fontSize:13},
  createFormScroll:{flex:1,backgroundColor:"#f4f6f8"},
  createSection:{margin:12,backgroundColor:"#fff",padding:16,borderRadius:16},
  input:{borderWidth:1,borderColor:"#ddd",padding:10,borderRadius:10,marginBottom:8},
  selectorLabel:{fontSize:13,fontWeight:"600",color:"#374151",marginBottom:6,marginTop:4},
  targetModeRow:{flexDirection:"row",flexWrap:"wrap",gap:8,marginBottom:8},
  groupSelector:{flexGrow:0,flexShrink:0,height:40,marginBottom:10},
  groupSelectorContent:{flexDirection:"row",alignItems:"center",gap:8},
  groupChip:{paddingHorizontal:12,paddingVertical:6,borderRadius:20,borderWidth:1,borderColor:"#d1d5db",backgroundColor:"#f9fafb",flexShrink:0},
  groupChipActive:{backgroundColor:"#2563eb",borderColor:"#2563eb"},
  groupChipText:{fontSize:12,fontWeight:"600",color:"#374151"},
  groupChipTextActive:{color:"#fff"},
  suggestionsBox:{backgroundColor:"#fff",borderRadius:10,borderWidth:1,borderColor:"#e5e7eb",marginBottom:8},
  suggestionRow:{paddingHorizontal:14,paddingVertical:10,borderBottomWidth:1,borderBottomColor:"#f3f4f6"},
  suggestionText:{fontSize:13,color:"#374151"},
  priorityRow:{flexDirection:"row",gap:8,marginBottom:12},
  priorityChip:{flex:1,paddingVertical:8,borderRadius:10,borderWidth:1,borderColor:"#d1d5db",alignItems:"center",backgroundColor:"#f9fafb"},
  priorityChipActive:{borderColor:"transparent"},
  priorityChipText:{fontSize:12,fontWeight:"600",color:"#374151"},
  priorityChipTextActive:{color:"#fff"},
  createButton:{backgroundColor:"#2563eb",padding:12,borderRadius:12},
  saveButton:{backgroundColor:"#2563eb",padding:10,borderRadius:10},
  buttonText:{color:"#fff",textAlign:"center",fontWeight:"600"},
});