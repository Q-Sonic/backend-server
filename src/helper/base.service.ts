import { getFirestore, admin } from '../config/firebase';

/**
 * Interface for pagination options
 */
export interface PaginateOptions {
  skip?: number;
  take?: number;
  filterField?: string;
  filterValue?: string;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

/**
 * Interface for the pagination result
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  skip: number;
  take: number;
}

/**
 * Abstract Base Service for Firestore CRUD operations
 */
export abstract class BaseFirestoreService<T extends { uid?: string; id?: string }> {
  protected db: admin.firestore.Firestore;
  protected collection: string;

  constructor(collectionName: string) {
    this.db = getFirestore();
    this.collection = collectionName;
  }

  /**
   * Find a single document by ID
   */
  async findById(id: string): Promise<T | null> {
    const doc = await this.db.collection(this.collection).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as T;
  }

  /**
   * Create a new document
   */
  async create(data: Omit<T, 'id' | 'uid' | 'createdAt' | 'updatedAt'> & { uid?: string }): Promise<T> {
    const now = admin.firestore.Timestamp.now();
    const docRef = data.uid 
      ? this.db.collection(this.collection).doc(data.uid)
      : this.db.collection(this.collection).doc();
    
    const record = {
      ...data,
      id: docRef.id,
      uid: docRef.id,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(record);
    return record as unknown as T;
  }

  /**
   * Update an existing document
   */
  async update(id: string, data: Partial<T>): Promise<T> {
    const ref = this.db.collection(this.collection).doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new Error(`Document ${id} in ${this.collection} not found`);

    const updated = {
      ...data,
      updatedAt: admin.firestore.Timestamp.now(),
    };

    await ref.update(updated);
    const updatedDoc = await ref.get();
    return { id: updatedDoc.id, ...updatedDoc.data() } as T;
  }

  /**
   * Delete a document
   */
  async delete(id: string): Promise<void> {
    const ref = this.db.collection(this.collection).doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new Error(`Document ${id} in ${this.collection} not found`);
    await ref.delete();
  }

  /**
   * Find documents by a specific field value (Search by Tag/Field)
   */
  async findByField(field: string, value: any): Promise<T[]> {
    const snapshot = await this.db.collection(this.collection)
      .where(field, '==', value)
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
  }

  /**
   * Paginacion avanzada con filtrado (prefijo y exacto)
   */
  async paginate(options: PaginateOptions & { tagField?: string, tagValue?: any } = {}): Promise<PaginatedResult<T>> {
    const {
      skip = 0,
      take = 20,
      filterField,
      filterValue,
      tagField,
      tagValue,
      orderBy = 'createdAt',
      orderDirection = 'desc'
    } = options;

    let query: admin.firestore.Query = this.db.collection(this.collection);

    // 1. Exact Match (Tag Filter)
    if (tagField && tagValue !== undefined) {
      query = query.where(tagField, '==', tagValue);
    }

    // 2. Prefix Match (Text Search)
    if (filterField && filterValue) {
      query = query
        .where(filterField, '>=', filterValue)
        .where(filterField, '<=', filterValue + '\uf8ff');
    }

    // Calculate total using count() - Firestore v3+
    const countSnapshot = await query.count().get();
    const totalCount = countSnapshot.data().count;

    // Execute paginated query
    const snapshot = await query
      .orderBy(orderBy, orderDirection)
      .offset(skip)
      .limit(take)
      .get();

    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    
    return {
      data,
      total: totalCount,
      skip,
      take
    };
  }
}
