import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getCompetitionQuestions } from '../services/competitionStorage';

export default function CompetitionListScreen({ navigation, route }) {
  const [questions, setQuestions] = useState([]);
  const isAdmin = route.params?.isAdmin ?? false;

  const loadQuestions = async () => {
    const data = await getCompetitionQuestions();
    setQuestions(data);
  };

  useFocusEffect(
    useCallback(() => {
      loadQuestions();
    }, [])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Competition Area</Text>

      {isAdmin && (
        <TouchableOpacity
          style={styles.postButton}
          onPress={() => navigation.navigate('CompetitionCreate', { isAdmin })}
        >
          <Text style={styles.postButtonText}>Post Question</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={questions}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No questions yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              navigation.navigate('CompetitionDetail', {
                questionId: item.id,
                isAdmin,
              })
            }
          >
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text numberOfLines={2} style={styles.cardText}>
              {item.description}
            </Text>
            <Text style={styles.replyCount}>Replies: {item.replies?.length || 0}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 16 },
  postButton: {
    backgroundColor: '#2e86de',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  postButtonText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },
  card: {
    backgroundColor: '#f2f2f2',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  cardText: { fontSize: 14, color: '#444' },
  replyCount: { marginTop: 8, color: '#666' },
  empty: { textAlign: 'center', marginTop: 30, color: '#777' },
});