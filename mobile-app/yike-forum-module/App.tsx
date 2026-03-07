import React, { useState } from 'react';
import {
  Alert,
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

interface Comment {
  id: number;
  author: string;
  content: string;
}

interface Announcement {
  id: number;
  title: string;
  comments: Comment[];
}

interface ForumReply {
  id: number;
  author: string;
  content: string;
}

interface ForumPost {
  id: number;
  title: string;
  author: string;
  content: string;
  replies: ForumReply[];
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [announcements, setAnnouncements] = useState<Announcement[]>([
    { id: 1, title: 'Welcome to issue an announcement', comments: [] },
  ]);
  const [newTitle, setNewTitle] = useState('');
  const [contentPage, setContentPage] = useState(true);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<number | null>(null);
  const [newComment, setNewComment] = useState('');

  const [forumPage, setForumPage] = useState(false);
  const [selectedForumPostId, setSelectedForumPostId] = useState<number | null>(null);
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [newForumTitle, setNewForumTitle] = useState('');
  const [newForumContent, setNewForumContent] = useState('');
  const [newReply, setNewReply] = useState('');

  const getDisplayName = () => {
    if (username.trim() !== '') return username;
    if (userRole === 'admin') return 'Admin';
    return 'User';
  };

  const handleLogin = () => {
    if (username === 'Ryan' && password === '1234') {
      setLoggedIn(true);
      setUserRole('admin');
      setContentPage(true);
      setForumPage(false);
    } else if (username === 'user' && password === 'qwer') {
      setLoggedIn(true);
      setUserRole('user');
      setContentPage(true);
      setForumPage(false);  
    } else {
      Alert.alert('Login failed', 'Incorrect username or password. Please try again!');
    }
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setUserRole(null);
    setUsername('');
    setPassword('');
    setContentPage(true);
    setForumPage(false);
    setSelectedAnnouncementId(null);
    setSelectedForumPostId(null);
    setNewComment('');
    setNewReply('');
    setNewForumTitle('');
    setNewForumContent('');
  };

  const handleAddAnnouncement = () => {
    if (newTitle.trim() === '') {
      Alert.alert('Content cannot be empty.', 'Please enter the announcement content before publishing.');
      return;
    }

    const newAnnouncement: Announcement = {
      id: Date.now(),
      title: newTitle,
      comments: [],
    };

    setAnnouncements([...announcements, newAnnouncement]);
    setNewTitle('');
  };

  const handleDeleteAnnouncement = (id: number) => {
    const remaining = announcements.filter(item => item.id !== id);
    setAnnouncements(remaining);
  };

  const handleAddComment = () => {
    if (newComment.trim() === '') {
      Alert.alert('Content cannot be empty.', 'Please enter your comment before submitting.');
      return;
    }
    if (selectedAnnouncementId === null) return;

    const newCommentObj: Comment = {
      id: Date.now(),
      author: getDisplayName(),
      content: newComment,
    };

    setAnnouncements(prev =>
      prev.map(ann => {
        if (ann.id === selectedAnnouncementId) {
          return { ...ann, comments: [...ann.comments, newCommentObj] };
        }
        return ann;
      })
    );
    setNewComment('');
  };

  const handleAddForumPost = () => {
    if (newForumTitle.trim() === '' || newForumContent.trim() === '') {
      Alert.alert('Incomplete forum post', 'Please enter both a forum title and forum content.');
      return;
    }

    const post: ForumPost = {
      id: Date.now(),
      title: newForumTitle,
      author: getDisplayName(),
      content: newForumContent,
      replies: [],
    };

    setForumPosts(prev => [post, ...prev]);
    setNewForumTitle('');
    setNewForumContent('');
  };

  const handleDeleteForumPost = (id: number) => {
    setForumPosts(prev => prev.filter(post => post.id !== id));
    if (selectedForumPostId === id) {
      setSelectedForumPostId(null);
    }
  };

  const handleAddReply = () => {
    if (newReply.trim() === '') {
      Alert.alert('Reply cannot be empty', 'Please enter your reply before submitting.');
      return;
    }
    if (selectedForumPostId === null) return;

    const reply: ForumReply = {
      id: Date.now(),
      author: getDisplayName(),
      content: newReply,
    };

    setForumPosts(prev =>
      prev.map(post => {
        if (post.id === selectedForumPostId) {
          return { ...post, replies: [...post.replies, reply] };
        }
        return post;
      })
    );
    setNewReply('');
  };

  const handleDeleteReply = (replyId: number) => {
    if (selectedForumPostId === null) return;

    setForumPosts(prev =>
      prev.map(post => {
        if (post.id === selectedForumPostId) {
          return {
            ...post,
            replies: post.replies.filter(reply => reply.id !== replyId),
          };
        }
        return post;
      })
    );
  };

  if (!loggedIn) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Login</Text>
        <TextInput
          style={styles.input}
          placeholder="username"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="password"
          value={password}
          secureTextEntry={true}
          onChangeText={setPassword}
        />
        <Button title="Login" onPress={handleLogin} />
      </View>
    );
  }

  if (loggedIn && contentPage) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Dashboard</Text>

        <TouchableOpacity style={styles.dashboardBox} onPress={() => setContentPage(false)}>
          <Text style={styles.dashboardTitle}>Announcement System</Text>
          <Text style={styles.dashboardDesc}>View announcements and comments</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dashboardBox}
          onPress={() => {
            setForumPage(true);
            setContentPage(false);
            setSelectedForumPostId(null);
          }}
        >
          <Text style={styles.dashboardTitle}>Forum Module</Text>
          <Text style={styles.dashboardDesc}>Create forums, post messages, and reply</Text>
        </TouchableOpacity>

        <Button title="Logout" onPress={handleLogout} />
      </View>
    );
  }

  if (loggedIn && !contentPage && !forumPage && selectedAnnouncementId === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Announcement List</Text>
        <FlatList
          data={announcements}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setSelectedAnnouncementId(item.id)}>
              <View style={styles.itemContainer}>
                <Text style={styles.itemText}>{item.title}</Text>
                {userRole === 'admin' && (
                  <Button title="Delete" onPress={() => handleDeleteAnnouncement(item.id)} />
                )}
              </View>
            </TouchableOpacity>
          )}
        />
        {userRole === 'admin' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Enter new announcement content..."
              value={newTitle}
              onChangeText={setNewTitle}
            />
            <Button title="Publish Announcement" onPress={handleAddAnnouncement} />
          </>
        )}
        <View style={styles.spacer} />
        <Button title="Back to Dashboard" onPress={() => setContentPage(true)} />
      </View>
    );
  }

  if (loggedIn && selectedAnnouncementId !== null) {
    const currentAnnouncement = announcements.find(ann => ann.id === selectedAnnouncementId);

    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Announcement Detail</Text>
        {currentAnnouncement && (
          <>
            <Text style={styles.itemText}>{currentAnnouncement.title}</Text>
            <Text style={styles.subHeading}>Comments</Text>
            <FlatList
              data={currentAnnouncement.comments}
              keyExtractor={item => item.id.toString()}
              renderItem={({ item }) => (
                <View style={styles.commentBox}>
                  <Text style={styles.authorText}>{item.author}</Text>
                  <Text style={styles.itemText}>- {item.content}</Text>
                </View>
              )}
              ListEmptyComponent={<Text>No comments yet.</Text>}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter your comment..."
              value={newComment}
              onChangeText={setNewComment}
            />
            <Button title="Submit Comment" onPress={handleAddComment} />
            <View style={styles.spacer} />
            <Button title="Back to List" onPress={() => setSelectedAnnouncementId(null)} />
          </>
        )}
      </View>
    );
  }

  if (loggedIn && forumPage && selectedForumPostId === null) {
    return (
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.heading}>Forum Module</Text>

        <View style={styles.sectionBox}>
          <Text style={styles.subHeading}>Create New Forum Post</Text>
          <TextInput
            style={styles.input}
            placeholder="Forum title"
            value={newForumTitle}
            onChangeText={setNewForumTitle}
          />
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Write your forum content here..."
            value={newForumContent}
            onChangeText={setNewForumContent}
            multiline
          />
          <Button title="Publish Forum" onPress={handleAddForumPost} />
        </View>

        <View style={styles.sectionBox}>
          <Text style={styles.subHeading}>Forum Posts</Text>
          {forumPosts.length === 0 ? (
            <Text>No forum posts yet.</Text>
          ) : (
            forumPosts.map(post => (
              <TouchableOpacity
                key={post.id}
                style={styles.postCard}
                onPress={() => setSelectedForumPostId(post.id)}
              >
                <Text style={styles.postTitle}>{post.title}</Text>
                <Text style={styles.authorText}>By: {post.author}</Text>
                <Text numberOfLines={2} style={styles.postPreview}>
                  {post.content}
                </Text>
                <Text style={styles.replyCount}>Replies: {post.replies.length}</Text>
                {userRole === 'admin' && (
                  <View style={styles.deleteButtonWrapper}>
                    <Button title="Delete Forum" onPress={() => handleDeleteForumPost(post.id)} />
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        <Button
          title="Back to Dashboard"
          onPress={() => {
            setForumPage(false);
            setContentPage(true);
          }}
        />
        <View style={styles.spacer} />
      </ScrollView>
    );
  }

  if (loggedIn && forumPage && selectedForumPostId !== null) {
    const currentForumPost = forumPosts.find(post => post.id === selectedForumPostId);

    return (
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.heading}>Forum Detail</Text>

        {currentForumPost && (
          <>
            <View style={styles.sectionBox}>
              <Text style={styles.postTitle}>{currentForumPost.title}</Text>
              <Text style={styles.authorText}>By: {currentForumPost.author}</Text>
              <Text style={styles.postContent}>{currentForumPost.content}</Text>
            </View>

            <View style={styles.sectionBox}>
              <Text style={styles.subHeading}>Replies</Text>
              {currentForumPost.replies.length === 0 ? (
                <Text>No replies yet.</Text>
              ) : (
                currentForumPost.replies.map(reply => (
                  <View key={reply.id} style={styles.replyBox}>
                    <Text style={styles.authorText}>{reply.author}</Text>
                    <Text style={styles.itemText}>{reply.content}</Text>
                    {userRole === 'admin' && (
                      <View style={styles.deleteButtonWrapper}>
                        <Button title="Delete Reply" onPress={() => handleDeleteReply(reply.id)} />
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>

            <View style={styles.sectionBox}>
              <Text style={styles.subHeading}>Add Reply</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Write your reply..."
                value={newReply}
                onChangeText={setNewReply}
                multiline
              />
              <Button title="Submit Reply" onPress={handleAddReply} />
            </View>

            <Button title="Back to Forum List" onPress={() => setSelectedForumPostId(null)} />
          </>
        )}
      </ScrollView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  scrollContainer: {
    padding: 20,
    backgroundColor: '#fff',
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  subHeading: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  input: {
    minHeight: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  itemText: {
    fontSize: 18,
    flexShrink: 1,
  },
  dashboardBox: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  dashboardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  dashboardDesc: {
    fontSize: 14,
    color: '#555',
  },
  sectionBox: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  postCard: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  postTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  postPreview: {
    fontSize: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  postContent: {
    fontSize: 17,
    lineHeight: 24,
    marginTop: 8,
  },
  replyBox: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  commentBox: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  authorText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  replyCount: {
    fontSize: 14,
    color: '#555',
  },
  deleteButtonWrapper: {
    marginTop: 10,
  },
  spacer: {
    height: 12,
  },
});
