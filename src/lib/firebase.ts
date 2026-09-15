import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  collection,
  doc,
  getDocs,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  setLogLevel,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Student, AttendanceRecord, PermissionRequest, NotificationLog, AppSettings, HomeroomTeacher, ScanFailureLog, CardResolutionStatus } from '../types';
import { INITIAL_STUDENTS, INITIAL_SETTINGS, INITIAL_PERMISSIONS, INITIAL_TEACHERS, INITIAL_SCAN_FAILURES, generateInitialAttendance } from '../data/initialData';

// Initialize Firebase App singleton
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Safely get Auth instance if registered without throwing component registration errors
export function getFirebaseAuth(): Auth | null {
  try {
    return getAuth(app);
  } catch {
    return null;
  }
}

export const auth: Auth | null = getFirebaseAuth();

// Suppress noisy internal Firestore WebChannel transient retry messages
setLogLevel('silent');

// Initialize Firestore with custom databaseId and resilient connection settings
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
    },
    firebaseConfig.firestoreDatabaseId || undefined
  );
} catch {
  firestoreInstance = firebaseConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
}

export const db: Firestore = firestoreInstance;

// Test Firestore connection on boot
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch {
    return false;
  }
}

// Error handling standard conforming to Firebase skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Firestore Collection References
export const COLLECTIONS = {
  STUDENTS: 'students',
  TEACHERS: 'homeroom_teachers',
  ATTENDANCE: 'attendance_records',
  PERMISSIONS: 'permissions',
  NOTIFICATIONS: 'notification_logs',
  SCAN_FAILURES: 'scan_failure_logs',
  SETTINGS: 'app_settings',
};

/**
 * Helper to clean object from undefined properties so Firestore never throws unsupported field value error
 */
function sanitizeForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  if (!obj || typeof obj !== 'object') return obj;

  Object.keys(obj).forEach((key) => {
    const val = (obj as any)[key];
    if (val !== undefined) {
      if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Timestamp) && !(val instanceof Date)) {
        clean[key] = sanitizeForFirestore(val);
      } else {
        clean[key] = val;
      }
    }
  });
  return clean;
}

/**
 * Seed initial students and settings to Firestore if database is empty
 */
export async function seedInitialFirestoreData(): Promise<void> {
  try {
    const settingsDocRef = doc(db, COLLECTIONS.SETTINGS, 'default');
    const settingsSnap = await getDoc(settingsDocRef);
    if (settingsSnap.exists()) {
      const data = settingsSnap.data();
      if (data?.initialSeedCompleted) {
        // Database is already initialized or user intentionally cleared it for production/hosting
        return;
      }
    }

    // Check if students collection has data
    const studentsRef = collection(db, COLLECTIONS.STUDENTS);
    const snapshot = await getDocs(studentsRef);

    if (snapshot.empty) {
      console.log('Seeding initial data to Firestore...');
      const batch = writeBatch(db);

      // Seed Initial Students
      INITIAL_STUDENTS.forEach((student) => {
        const studentDoc = doc(db, COLLECTIONS.STUDENTS, student.id);
        const data = sanitizeForFirestore({
          ...student,
          photoUrl: student.photoUrl || '',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        batch.set(studentDoc, data);
      });

      // Seed Initial Settings with initialSeedCompleted flag
      batch.set(settingsDocRef, sanitizeForFirestore({
        ...INITIAL_SETTINGS,
        initialSeedCompleted: true,
      }), { merge: true });

      // Seed Initial Homeroom Teachers
      INITIAL_TEACHERS.forEach((teacher) => {
        const teacherDoc = doc(db, COLLECTIONS.TEACHERS, teacher.id);
        const data = sanitizeForFirestore({
          ...teacher,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        batch.set(teacherDoc, data);
      });

      // Seed Initial Permissions
      INITIAL_PERMISSIONS.forEach((perm) => {
        const permDoc = doc(db, COLLECTIONS.PERMISSIONS, perm.id);
        const data = sanitizeForFirestore({
          ...perm,
          rawMessage: perm.rawMessage || '',
        });
        batch.set(permDoc, data);
      });

      // Seed Initial Scan Failures
      INITIAL_SCAN_FAILURES.forEach((fail) => {
        const failDoc = doc(db, COLLECTIONS.SCAN_FAILURES, fail.id);
        batch.set(failDoc, sanitizeForFirestore({
          ...fail,
          createdAt: Timestamp.now(),
        }));
      });

      // Seed sample attendance records
      const initialAttendance = generateInitialAttendance(INITIAL_STUDENTS);
      initialAttendance.forEach((rec) => {
        const attDoc = doc(db, COLLECTIONS.ATTENDANCE, rec.id);
        const data = sanitizeForFirestore({
          ...rec,
          type: rec.type || 'MASUK',
          notes: rec.notes || '',
          createdAt: Timestamp.now(),
        });
        batch.set(attDoc, data);
      });

      await batch.commit();
      console.log('Firestore seed completed successfully!');
    }
  } catch (error) {
    console.warn('Firestore initial seed deferred or skipped (offline/sync pending):', error);
  }
}

/**
 * Generate 100+ bulk mock Indonesian SD students for testing large school scale
 */
export async function generateBulkStudentsFirestore(count: number = 100): Promise<number> {
  try {
    const firstNames = [
      'Aditya', 'Ahmad', 'Alif', 'Ananda', 'Bayu', 'Bagas', 'Bima', 'Cahyo', 'Danang', 'Dimas',
      'Eko', 'Fajar', 'Galih', 'Gilang', 'Hafizh', 'Ilham', 'Indra', 'Joko', 'Kevin', 'Kurniawan',
      'Lukman', 'Maulana', 'Naufal', 'Pratama', 'Putra', 'Raditya', 'Rafi', 'Rehan', 'Rian', 'Rizky',
      'Satria', 'Taufik', 'Wahyu', 'Yoga', 'Zidan',
      'Aisyah', 'Alia', 'Anisa', 'Aulia', 'Azkia', 'Bilqis', 'Citra', 'Dina', 'Fadhilah', 'Fitri',
      'Gita', 'Hana', 'Indah', 'Intan', 'Khairunisa', 'Laila', 'Maya', 'Nabila', 'Nadia', 'Nayra',
      'Nurul', 'Putri', 'Rahma', 'Salma', 'Siti', 'Syifa', 'Tania', 'Tiara', 'Wulan', 'Zahra',
    ];

    const lastNames = [
      'Santoso', 'Pratama', 'Kusuma', 'Saputra', 'Hidayat', 'Ramadhan', 'Wijaya', 'Nugroho',
      'Permana', 'Setiawan', 'Firmansyah', 'Siregar', 'Lestari', 'Wulandari', 'Utami', 'Puspitasari',
      'Rahmawati', 'Anggraini', 'Dewi', 'Kartika', 'Sulistyo', 'Gunawan', 'Hakim', 'Mahendra',
    ];

    const classes = [
      'Kelas 1A', 'Kelas 1B', 'Kelas 2A', 'Kelas 2B',
      'Kelas 3A', 'Kelas 3B', 'Kelas 4A', 'Kelas 4B',
      'Kelas 5A', 'Kelas 5B', 'Kelas 6A', 'Kelas 6B',
    ];

    let batch = writeBatch(db);
    const existingCount = (await getDocs(collection(db, COLLECTIONS.STUDENTS))).size;

    let added = 0;
    for (let i = 1; i <= count; i++) {
      const idx = existingCount + i;
      const isMale = i % 2 === 0;
      const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const fullName = `${fName} ${lName}`;
      const nisn = `015${String(1000000 + idx).slice(1)}`;
      const assignedClass = classes[Math.floor(Math.random() * classes.length)];
      const parentPhone = `6281${Math.floor(10000000 + Math.random() * 90000000)}`;

      const newStudent: Student = {
        id: `std-bulk-${idx}`,
        nisn,
        name: fullName,
        class: assignedClass,
        gender: isMale ? 'L' : 'P',
        parentPhone,
        photoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=0D9488&color=fff`,
      };

      const studentDoc = doc(db, COLLECTIONS.STUDENTS, newStudent.id);
      batch.set(studentDoc, sanitizeForFirestore({
        ...newStudent,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }));
      added++;

      // Firestore batches can hold max 500 operations
      if (added % 400 === 0) {
        await batch.commit();
        batch = writeBatch(db);
      }
    }

    await batch.commit();
    return added;
  } catch (error) {
    console.error('Error generating bulk students in Firestore:', error);
    throw error;
  }
}

// Student CRUD Operations
export async function saveStudentFirestore(student: Student): Promise<void> {
  const studentDoc = doc(db, COLLECTIONS.STUDENTS, student.id);
  await setDoc(studentDoc, sanitizeForFirestore({
    ...student,
    photoUrl: student.photoUrl || '',
    updatedAt: Timestamp.now(),
  }), { merge: true });
}

export async function deleteStudentFirestore(studentId: string): Promise<void> {
  const studentDoc = doc(db, COLLECTIONS.STUDENTS, studentId);
  await deleteDoc(studentDoc);
}

// Homeroom Teacher CRUD Operations
export async function saveTeacherFirestore(teacher: HomeroomTeacher): Promise<void> {
  const teacherDoc = doc(db, COLLECTIONS.TEACHERS, teacher.id);
  await setDoc(teacherDoc, sanitizeForFirestore({
    ...teacher,
    updatedAt: Timestamp.now(),
  }), { merge: true });
}

export async function deleteTeacherFirestore(teacherId: string): Promise<void> {
  const teacherDoc = doc(db, COLLECTIONS.TEACHERS, teacherId);
  await deleteDoc(teacherDoc);
}

// Attendance Record Operations
export async function recordAttendanceFirestore(record: AttendanceRecord): Promise<void> {
  const attDoc = doc(db, COLLECTIONS.ATTENDANCE, record.id);
  await setDoc(attDoc, sanitizeForFirestore({
    ...record,
    type: record.type || 'MASUK',
    notes: record.notes || '',
    createdAt: Timestamp.now(),
  }), { merge: true });
}

// Permission Operations
export async function savePermissionFirestore(permission: PermissionRequest): Promise<void> {
  const permDoc = doc(db, COLLECTIONS.PERMISSIONS, permission.id);
  await setDoc(permDoc, sanitizeForFirestore({
    ...permission,
    rawMessage: permission.rawMessage || '',
  }), { merge: true });
}

export async function updatePermissionStatusFirestore(
  permissionId: string,
  status: 'APPROVED' | 'REJECTED'
): Promise<void> {
  const permDoc = doc(db, COLLECTIONS.PERMISSIONS, permissionId);
  await updateDoc(permDoc, { status });
}

// Notification Logs Operations
export async function saveNotificationLogFirestore(log: NotificationLog): Promise<void> {
  const logDoc = doc(db, COLLECTIONS.NOTIFICATIONS, log.id);
  await setDoc(logDoc, sanitizeForFirestore({
    ...log,
    date: log.date || new Date().toISOString().split('T')[0],
  }), { merge: true });
}

export async function deleteNotificationLogFirestore(logId: string): Promise<void> {
  const logDoc = doc(db, COLLECTIONS.NOTIFICATIONS, logId);
  await deleteDoc(logDoc);
}

export async function deleteNotificationLogsBatchFirestore(logIds: string[]): Promise<void> {
  if (logIds.length === 0) return;
  const batch = writeBatch(db);
  logIds.forEach((id) => {
    const logDoc = doc(db, COLLECTIONS.NOTIFICATIONS, id);
    batch.delete(logDoc);
  });
  await batch.commit();
}

// Scan Failure Logs Operations
export async function saveScanFailureLogFirestore(log: ScanFailureLog): Promise<void> {
  const logDoc = doc(db, COLLECTIONS.SCAN_FAILURES, log.id);
  await setDoc(logDoc, sanitizeForFirestore({
    ...log,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }), { merge: true });
}

export async function updateScanFailureStatusFirestore(
  logId: string,
  resolutionStatus: CardResolutionStatus,
  notes?: string
): Promise<void> {
  const logDoc = doc(db, COLLECTIONS.SCAN_FAILURES, logId);
  const updateData: any = {
    resolutionStatus,
    updatedAt: Timestamp.now(),
  };
  if (notes !== undefined) {
    updateData.notes = notes;
  }
  await updateDoc(logDoc, updateData);
}

export async function deleteScanFailureLogFirestore(logId: string): Promise<void> {
  const logDoc = doc(db, COLLECTIONS.SCAN_FAILURES, logId);
  await deleteDoc(logDoc);
}

// Settings Operations
export async function saveSettingsFirestore(settings: AppSettings): Promise<void> {
  const settingsDoc = doc(db, COLLECTIONS.SETTINGS, 'default');
  await setDoc(settingsDoc, sanitizeForFirestore(settings), { merge: true });
}

// Mark Firestore as initialized (so dummy seeds will never re-populate empty database)
export async function markFirestoreInitialized(): Promise<void> {
  try {
    const settingsDoc = doc(db, COLLECTIONS.SETTINGS, 'default');
    await setDoc(
      settingsDoc,
      sanitizeForFirestore({
        initialSeedCompleted: true,
        updatedAt: Timestamp.now(),
      }),
      { merge: true }
    );
  } catch (error) {
    console.warn('Failed to mark Firestore as initialized:', error);
  }
}

// Clear All Students in Firestore
export async function clearAllStudentsFirestore(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.STUDENTS));
    if (snap.empty) return;
    let batch = writeBatch(db);
    let count = 0;
    for (const docSnap of snap.docs) {
      batch.delete(docSnap.ref);
      count++;
      if (count % 400 === 0) {
        await batch.commit();
        batch = writeBatch(db);
      }
    }
    await batch.commit();
  } catch (error) {
    console.error('Failed to clear students from Firestore:', error);
    throw error;
  }
}

// Clear All Teachers in Firestore
export async function clearAllTeachersFirestore(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.TEACHERS));
    if (snap.empty) return;
    let batch = writeBatch(db);
    let count = 0;
    for (const docSnap of snap.docs) {
      batch.delete(docSnap.ref);
      count++;
      if (count % 400 === 0) {
        await batch.commit();
        batch = writeBatch(db);
      }
    }
    await batch.commit();
  } catch (error) {
    console.error('Failed to clear teachers from Firestore:', error);
    throw error;
  }
}

// Clear All Attendance Records in Firestore
export async function clearAllAttendanceFirestore(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.ATTENDANCE));
    if (snap.empty) return;
    let batch = writeBatch(db);
    let count = 0;
    for (const docSnap of snap.docs) {
      batch.delete(docSnap.ref);
      count++;
      if (count % 400 === 0) {
        await batch.commit();
        batch = writeBatch(db);
      }
    }
    await batch.commit();
  } catch (error) {
    console.error('Failed to clear attendance records from Firestore:', error);
    throw error;
  }
}

// Clear All Permissions in Firestore
export async function clearAllPermissionsFirestore(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.PERMISSIONS));
    if (snap.empty) return;
    let batch = writeBatch(db);
    let count = 0;
    for (const docSnap of snap.docs) {
      batch.delete(docSnap.ref);
      count++;
      if (count % 400 === 0) {
        await batch.commit();
        batch = writeBatch(db);
      }
    }
    await batch.commit();
  } catch (error) {
    console.error('Failed to clear permissions from Firestore:', error);
    throw error;
  }
}

// Restore / Bulk import Students to Firestore
export async function restoreStudentsFirestore(students: Student[]): Promise<void> {
  if (!students || students.length === 0) return;
  let batch = writeBatch(db);
  let count = 0;
  for (const s of students) {
    const sDoc = doc(db, COLLECTIONS.STUDENTS, s.id);
    batch.set(sDoc, sanitizeForFirestore({
      ...s,
      photoUrl: s.photoUrl || '',
      updatedAt: Timestamp.now(),
    }), { merge: true });
    count++;
    if (count % 400 === 0) {
      await batch.commit();
      batch = writeBatch(db);
    }
  }
  await batch.commit();
}

// Restore / Bulk import Teachers to Firestore
export async function restoreTeachersFirestore(teachers: HomeroomTeacher[]): Promise<void> {
  if (!teachers || teachers.length === 0) return;
  let batch = writeBatch(db);
  let count = 0;
  for (const t of teachers) {
    const tDoc = doc(db, COLLECTIONS.TEACHERS, t.id);
    batch.set(tDoc, sanitizeForFirestore({
      ...t,
      updatedAt: Timestamp.now(),
    }), { merge: true });
    count++;
    if (count % 400 === 0) {
      await batch.commit();
      batch = writeBatch(db);
    }
  }
  await batch.commit();
}

