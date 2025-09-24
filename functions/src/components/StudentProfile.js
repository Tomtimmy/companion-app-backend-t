// src/components/StudentProfile.js
import React from 'react';
import { View, Text, Button, ActivityIndicator } from 'react-native';
import { useStudentStore } from '../store/studentStore';

export default function StudentProfile({ id }) {
  const { student, loading, error, fetchStudent } = useStudentStore();

  return (
    <View>
      {loading && <ActivityIndicator testID="loading" />}
      {error && <Text testID="error">{error}</Text>}

      {student ? (
        <>
          <Text testID="name">{student.name}</Text>
          <Text testID="course">{student.course}</Text>
        </>
      ) : (
        <Text testID="no-data">No student loaded</Text>
      )}

      <Button title="Load" onPress={() => fetchStudent(id)} />
    </View>
  );
}
