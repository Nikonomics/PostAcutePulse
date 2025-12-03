#!/usr/bin/env python3
"""
Import Contract Taxonomy and Naming Conventions into SQLite database
"""

import sqlite3
import pandas as pd
import os

# Paths
DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'database.sqlite')
TAXONOMY_FILE = '/Users/nikolashulewsky/Downloads/Contract_Taxonomy (2).xlsx'
NAMING_FILE = '/Users/nikolashulewsky/Downloads/Naming Conventions (2).xlsx'

def create_tables(conn):
    """Create all taxonomy tables"""
    cursor = conn.cursor()

    # Facilities table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS facilities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            facility_id VARCHAR(20) UNIQUE,
            facility_group VARCHAR(50),
            raw_name VARCHAR(255),
            name VARCHAR(255),
            short_name VARCHAR(100),
            line VARCHAR(50),
            legal_entity VARCHAR(255),
            address VARCHAR(255),
            city VARCHAR(100),
            state VARCHAR(10),
            status INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Functional Categories table (12 categories)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS functional_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(100) UNIQUE NOT NULL,
            description TEXT,
            example_subcategories TEXT,
            sort_order INTEGER,
            status INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Service Subcategories table (57 subcategories)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS service_subcategories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            functional_category_id INTEGER,
            name VARCHAR(150) UNIQUE NOT NULL,
            department VARCHAR(100),
            sort_order INTEGER,
            status INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (functional_category_id) REFERENCES functional_categories(id)
        )
    ''')

    # Document Types table (34 types)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS document_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(150) UNIQUE NOT NULL,
            primary_category VARCHAR(100),
            description TEXT,
            sort_order INTEGER,
            status INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Document Tags table (controlled vocabulary)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS document_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(100) UNIQUE NOT NULL,
            tag_group VARCHAR(100),
            description TEXT,
            status INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Document Type Tag Assignments (many-to-many)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS document_type_tag_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_type_id INTEGER NOT NULL,
            tag_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (document_type_id) REFERENCES document_types(id),
            FOREIGN KEY (tag_id) REFERENCES document_tags(id),
            UNIQUE(document_type_id, tag_id)
        )
    ''')

    # Vendors table (1633 vendors)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS vendors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vendor_id VARCHAR(20),
            raw_name VARCHAR(255),
            canonical_name VARCHAR(255) NOT NULL,
            vendor_type VARCHAR(150),
            cleaned_type VARCHAR(150),
            notes TEXT,
            status INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Create indexes for performance
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_facilities_name ON facilities(name)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_facilities_state ON facilities(state)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_service_subcategories_category ON service_subcategories(functional_category_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_vendors_canonical ON vendors(canonical_name)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_vendors_type ON vendors(cleaned_type)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_document_tags_group ON document_tags(tag_group)')

    conn.commit()
    print("Tables created successfully!")

def import_facilities(conn):
    """Import facilities from Naming Conventions Excel"""
    df = pd.read_excel(NAMING_FILE, sheet_name='Facilities')
    cursor = conn.cursor()

    # Clear existing data
    cursor.execute('DELETE FROM facilities')

    count = 0
    for _, row in df.iterrows():
        try:
            cursor.execute('''
                INSERT INTO facilities (facility_id, facility_group, raw_name, name, short_name, line, legal_entity, address, city, state)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                str(row.get('Facilty ID', '')).strip() if pd.notna(row.get('Facilty ID')) else None,
                str(row.get('Group', '')).strip() if pd.notna(row.get('Group')) else None,
                str(row.get('Name on Raw Data', '')).strip() if pd.notna(row.get('Name on Raw Data')) else None,
                str(row.get('New Name (or Folder)', '')).strip() if pd.notna(row.get('New Name (or Folder)')) else None,
                str(row.get('Short_Name', '')).strip() if pd.notna(row.get('Short_Name')) else None,
                str(row.get('Line', '')).strip() if pd.notna(row.get('Line')) else None,
                str(row.get('Legal', '')).strip() if pd.notna(row.get('Legal')) else None,
                str(row.get('Address', '')).strip() if pd.notna(row.get('Address')) else None,
                str(row.get('City', '')).strip() if pd.notna(row.get('City')) else None,
                str(row.get('State', '')).strip() if pd.notna(row.get('State')) else None,
            ))
            count += 1
        except Exception as e:
            print(f"Error importing facility row: {e}")

    conn.commit()
    print(f"Imported {count} facilities")

def import_functional_categories(conn):
    """Import functional categories from Contract Taxonomy Excel"""
    df = pd.read_excel(TAXONOMY_FILE, sheet_name='Functional Categories')
    cursor = conn.cursor()

    # Clear existing data
    cursor.execute('DELETE FROM functional_categories')

    count = 0
    for _, row in df.iterrows():
        try:
            cursor.execute('''
                INSERT INTO functional_categories (name, description, example_subcategories, sort_order)
                VALUES (?, ?, ?, ?)
            ''', (
                str(row.get('Functional Category', '')).strip(),
                str(row.get('Description', '')).strip() if pd.notna(row.get('Description')) else None,
                str(row.get('Example Subcategories', '')).strip() if pd.notna(row.get('Example Subcategories')) else None,
                int(row.get('#', count + 1)),
            ))
            count += 1
        except Exception as e:
            print(f"Error importing category row: {e}")

    conn.commit()
    print(f"Imported {count} functional categories")

def import_service_subcategories(conn):
    """Import service subcategories from Contract Taxonomy Excel"""
    df = pd.read_excel(TAXONOMY_FILE, sheet_name='Service Subcategories')
    cursor = conn.cursor()

    # Clear existing data
    cursor.execute('DELETE FROM service_subcategories')

    # Get category ID mapping
    cursor.execute('SELECT id, name FROM functional_categories')
    category_map = {row[1]: row[0] for row in cursor.fetchall()}

    count = 0
    for _, row in df.iterrows():
        try:
            category_name = str(row.get('Functional Category', '')).strip()
            category_id = category_map.get(category_name)

            cursor.execute('''
                INSERT INTO service_subcategories (functional_category_id, name, department, sort_order)
                VALUES (?, ?, ?, ?)
            ''', (
                category_id,
                str(row.get('Service Subcategory', '')).strip(),
                str(row.get('Department', '')).strip() if pd.notna(row.get('Department')) else None,
                int(row.get('#', count + 1)),
            ))
            count += 1
        except Exception as e:
            print(f"Error importing subcategory row: {e}")

    conn.commit()
    print(f"Imported {count} service subcategories")

def import_document_types(conn):
    """Import document types from Contract Taxonomy Excel"""
    df = pd.read_excel(TAXONOMY_FILE, sheet_name='Document Types')
    cursor = conn.cursor()

    # Clear existing data
    cursor.execute('DELETE FROM document_types')

    count = 0
    for _, row in df.iterrows():
        try:
            cursor.execute('''
                INSERT INTO document_types (name, primary_category, description, sort_order)
                VALUES (?, ?, ?, ?)
            ''', (
                str(row.get('Document Type', '')).strip(),
                str(row.get('Category', '')).strip() if pd.notna(row.get('Category')) else None,
                str(row.get('Description', '')).strip() if pd.notna(row.get('Description')) else None,
                int(row.get('#', count + 1)),
            ))
            count += 1
        except Exception as e:
            print(f"Error importing document type row: {e}")

    conn.commit()
    print(f"Imported {count} document types")

def import_vendors(conn):
    """Import vendors from Naming Conventions Excel"""
    df = pd.read_excel(NAMING_FILE, sheet_name='Vendors')
    cursor = conn.cursor()

    # Clear existing data
    cursor.execute('DELETE FROM vendors')

    count = 0
    for idx, row in df.iterrows():
        try:
            # Generate vendor ID
            vendor_id = f"VND-{str(idx + 1).zfill(4)}"

            cursor.execute('''
                INSERT INTO vendors (vendor_id, raw_name, canonical_name, vendor_type, cleaned_type, notes)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                vendor_id,
                str(row.get('Vendor Name', '')).strip() if pd.notna(row.get('Vendor Name')) else None,
                str(row.get('Cleaned Vendor', '')).strip() if pd.notna(row.get('Cleaned Vendor')) else str(row.get('Vendor Name', '')).strip(),
                str(row.get('Type/Specialty', '')).strip() if pd.notna(row.get('Type/Specialty')) else None,
                str(row.get('Cleaned Type', '')).strip() if pd.notna(row.get('Cleaned Type')) else None,
                str(row.get('Notes', '')).strip() if pd.notna(row.get('Notes')) else None,
            ))
            count += 1
        except Exception as e:
            print(f"Error importing vendor row {idx}: {e}")

    conn.commit()
    print(f"Imported {count} vendors")

def create_document_tags(conn):
    """Create initial document tags based on document type categories"""
    cursor = conn.cursor()

    # Clear existing data
    cursor.execute('DELETE FROM document_type_tag_assignments')
    cursor.execute('DELETE FROM document_tags')

    # Define tags with groups
    tags = [
        # Compliance tags
        ('HIPAA', 'Compliance', 'HIPAA-related documents'),
        ('Insurance Required', 'Compliance', 'Documents requiring insurance verification'),
        ('State-Specific', 'Compliance', 'State-specific regulatory requirements'),
        ('BAA Required', 'Compliance', 'Requires Business Associate Agreement'),

        # Lifecycle tags
        ('Renewal', 'Lifecycle', 'Related to contract renewals'),
        ('Amendment', 'Lifecycle', 'Contract modifications'),
        ('Termination', 'Lifecycle', 'Contract termination documents'),
        ('New Contract', 'Lifecycle', 'New contract initiation'),
        ('Expiring Soon', 'Lifecycle', 'Contracts nearing expiration'),

        # Department tags
        ('Nursing', 'Department', 'Nursing department related'),
        ('Admin', 'Department', 'Administrative department'),
        ('IT', 'Department', 'Information Technology'),
        ('HR', 'Department', 'Human Resources'),
        ('Dietary', 'Department', 'Dietary/Food Services'),
        ('Maintenance', 'Department', 'Facilities/Maintenance'),
        ('Therapy', 'Department', 'Therapy services'),

        # Document nature tags
        ('Legal', 'Document Nature', 'Legal/contractual documents'),
        ('Financial', 'Document Nature', 'Financial terms/pricing'),
        ('Vendor Onboarding', 'Document Nature', 'New vendor setup'),
        ('Master Agreement', 'Document Nature', 'Master/umbrella agreements'),
        ('Supporting Doc', 'Document Nature', 'Supporting documentation'),

        # Priority tags
        ('High Priority', 'Priority', 'Requires immediate attention'),
        ('Review Required', 'Priority', 'Needs manual review'),
        ('Auto-Renewal', 'Priority', 'Has auto-renewal clause'),
    ]

    count = 0
    for name, group, description in tags:
        try:
            cursor.execute('''
                INSERT INTO document_tags (name, tag_group, description)
                VALUES (?, ?, ?)
            ''', (name, group, description))
            count += 1
        except Exception as e:
            print(f"Error creating tag {name}: {e}")

    conn.commit()
    print(f"Created {count} document tags")

    # Now create default tag assignments for document types
    # Map document type categories to relevant tags
    category_tag_mapping = {
        'Agreements': ['Legal', 'New Contract'],
        'Compliance & Legal': ['Legal', 'HIPAA', 'Compliance'],
        'Administrative': ['Admin', 'Vendor Onboarding'],
        'Modifications': ['Amendment', 'Legal'],
        'Actions': ['Legal', 'Lifecycle'],
        'Supporting Docs': ['Supporting Doc'],
        'Specialized': ['Legal'],
    }

    # Get document types and tags
    cursor.execute('SELECT id, name, primary_category FROM document_types')
    doc_types = cursor.fetchall()

    cursor.execute('SELECT id, name FROM document_tags')
    tag_map = {row[1]: row[0] for row in cursor.fetchall()}

    assignment_count = 0
    for doc_id, doc_name, category in doc_types:
        tags_to_assign = category_tag_mapping.get(category, [])

        # Add specific tags based on document name
        if 'BAA' in doc_name or 'HIPAA' in doc_name:
            tags_to_assign.extend(['HIPAA', 'BAA Required', 'Compliance'])
        if 'Insurance' in doc_name or 'COI' in doc_name:
            tags_to_assign.extend(['Insurance Required', 'Compliance'])
        if 'Amendment' in doc_name or 'Addendum' in doc_name:
            tags_to_assign.append('Amendment')
        if 'Renewal' in doc_name:
            tags_to_assign.append('Renewal')
        if 'Termination' in doc_name:
            tags_to_assign.append('Termination')
        if 'Master' in doc_name:
            tags_to_assign.append('Master Agreement')
        if 'Vendor' in doc_name:
            tags_to_assign.append('Vendor Onboarding')

        # Remove duplicates
        tags_to_assign = list(set(tags_to_assign))

        for tag_name in tags_to_assign:
            tag_id = tag_map.get(tag_name)
            if tag_id:
                try:
                    cursor.execute('''
                        INSERT OR IGNORE INTO document_type_tag_assignments (document_type_id, tag_id)
                        VALUES (?, ?)
                    ''', (doc_id, tag_id))
                    assignment_count += 1
                except Exception as e:
                    pass

    conn.commit()
    print(f"Created {assignment_count} tag assignments")

def main():
    print(f"Connecting to database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)

    try:
        print("\n1. Creating tables...")
        create_tables(conn)

        print("\n2. Importing facilities...")
        import_facilities(conn)

        print("\n3. Importing functional categories...")
        import_functional_categories(conn)

        print("\n4. Importing service subcategories...")
        import_service_subcategories(conn)

        print("\n5. Importing document types...")
        import_document_types(conn)

        print("\n6. Importing vendors...")
        import_vendors(conn)

        print("\n7. Creating document tags...")
        create_document_tags(conn)

        print("\n" + "=" * 50)
        print("IMPORT COMPLETE!")
        print("=" * 50)

        # Print summary
        cursor = conn.cursor()
        tables = ['facilities', 'functional_categories', 'service_subcategories', 'document_types', 'document_tags', 'vendors']
        for table in tables:
            cursor.execute(f'SELECT COUNT(*) FROM {table}')
            count = cursor.fetchone()[0]
            print(f"  {table}: {count} rows")

    finally:
        conn.close()

if __name__ == '__main__':
    main()
