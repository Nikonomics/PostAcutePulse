var express = require('express');
const requireAuthentication = require("../passport").authenticateUser;
const db = require('../models');
var router = express.Router();

// GET /api/users/contracts - List all contracts
router.get('/', requireAuthentication, async (req, res) => {
  try {
    const { page = 1, perPage = 10, search = '', status } = req.query;
    const offset = (page - 1) * perPage;

    // For now, return mock data since we don't have a contracts table yet
    const mockContracts = [
      {
        id: 1,
        contract_name: 'PT Services - ALF-A',
        unique_id: 'CNT-001',
        vendor_name: 'Select Rehabilitation',
        facility: { id: 1, name: 'Alderwood' },
        contract_status: 1,
        expiration_date: '2024-12-15',
        end_date: '2024-12-15',
        start_date: '2024-01-15',
        contract_value: 300000,
        contract_type: 'Healthcare Services',
        payment_terms: 'Net 30',
        auto_renewal: false,
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z',
      },
      {
        id: 2,
        contract_name: 'Pharmacy Services Agreement',
        unique_id: 'CNT-002',
        vendor_name: 'PharMerica',
        facility: { id: 2, name: 'Bellingham' },
        contract_status: 1,
        expiration_date: '2025-06-30',
        end_date: '2025-06-30',
        start_date: '2024-07-01',
        contract_value: 150000,
        contract_type: 'Pharmacy Services',
        payment_terms: 'Net 45',
        auto_renewal: true,
        created_at: '2024-07-01T00:00:00Z',
        updated_at: '2024-07-01T00:00:00Z',
      },
      {
        id: 3,
        contract_name: 'Medical Director Agreement',
        unique_id: 'CNT-003',
        vendor_name: 'Dr. James Wilson MD',
        facility: { id: 3, name: 'Cascadia Central' },
        contract_status: 2,
        expiration_date: '2024-03-31',
        end_date: '2024-03-31',
        start_date: '2023-04-01',
        contract_value: 120000,
        contract_type: 'Medical Director',
        payment_terms: 'Monthly',
        auto_renewal: false,
        created_at: '2023-04-01T00:00:00Z',
        updated_at: '2023-04-01T00:00:00Z',
      },
    ];

    // Filter by search
    let filtered = mockContracts;
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(c =>
        c.contract_name.toLowerCase().includes(searchLower) ||
        c.vendor_name.toLowerCase().includes(searchLower)
      );
    }

    // Filter by status
    if (status) {
      filtered = filtered.filter(c => c.contract_status === parseInt(status));
    }

    res.json({
      success: true,
      body: {
        contracts: filtered.slice(offset, offset + parseInt(perPage)),
        total: filtered.length,
        page: parseInt(page),
        perPage: parseInt(perPage),
      }
    });
  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch contracts' });
  }
});

// GET /api/users/contracts/:id - Get single contract
router.get('/:id', requireAuthentication, async (req, res) => {
  try {
    const { id } = req.params;

    // Mock contract detail
    const contract = {
      id: parseInt(id),
      contract_name: 'PT Services - ALF-A',
      unique_id: `CNT-00${id}`,
      vendor_name: 'Select Rehabilitation',
      facility: { id: 1, name: 'Alderwood' },
      contract_types: { id: 1, name: 'Healthcare Services' },
      contract_status: 1,
      expiration_date: '2024-12-15',
      end_date: '2024-12-15',
      start_date: '2024-01-15',
      effective_date: '2024-01-15',
      renewal_date: '2024-12-15',
      contract_value: 300000,
      payment_terms: 'Net 30',
      auto_renewal: false,
      tags: ['healthcare', 'therapy'],
      department: 'Operations',
      notice_period: '60',
      governing_law: 'State of Washington',
      pricing_model: 'Fixed Annual',
      contact_name: 'John Smith',
      contact_phone: '+1 (555) 123-4567',
      contact_email: 'john.smith@selectrehab.com',
      internal_owner: 'admin@cascadia.com',
      termination_clause: 'Either party may terminate this agreement with 60 days written notice.',
      key_obligations: 'Provide physical therapy services as outlined in the service agreement.',
      special_terms: 'Services to be provided Monday through Friday during business hours.',
      confidential: false,
      documents: [],
      user: {
        id: 1,
        full_name: 'Admin User',
        email: 'admin@cascadia.com',
      },
      created_at: '2024-01-15T00:00:00Z',
      updated_at: '2024-01-15T00:00:00Z',
    };

    res.json({
      success: true,
      body: contract
    });
  } catch (error) {
    console.error('Error fetching contract:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch contract' });
  }
});

// POST /api/users/contracts - Create contract
router.post('/', requireAuthentication, async (req, res) => {
  try {
    const contractData = req.body;

    // Mock create - return the data with an ID
    const newContract = {
      id: Date.now(),
      ...contractData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    res.json({
      success: true,
      message: 'Contract created successfully',
      body: newContract
    });
  } catch (error) {
    console.error('Error creating contract:', error);
    res.status(500).json({ success: false, message: 'Failed to create contract' });
  }
});

// PUT /api/users/contracts/:id - Update contract
router.put('/:id', requireAuthentication, async (req, res) => {
  try {
    const { id } = req.params;
    const contractData = req.body;

    const updatedContract = {
      id: parseInt(id),
      ...contractData,
      updated_at: new Date().toISOString(),
    };

    res.json({
      success: true,
      message: 'Contract updated successfully',
      body: updatedContract
    });
  } catch (error) {
    console.error('Error updating contract:', error);
    res.status(500).json({ success: false, message: 'Failed to update contract' });
  }
});

// DELETE /api/users/contracts/:id - Delete contract
router.delete('/:id', requireAuthentication, async (req, res) => {
  try {
    const { id } = req.params;

    res.json({
      success: true,
      message: 'Contract deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting contract:', error);
    res.status(500).json({ success: false, message: 'Failed to delete contract' });
  }
});

// GET /api/users/contracts/export - Export contracts
router.get('/export', requireAuthentication, async (req, res) => {
  try {
    // Return CSV data
    const csv = 'id,contract_name,vendor_name,status\n1,PT Services,Select Rehab,Active';
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=contracts.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting contracts:', error);
    res.status(500).json({ success: false, message: 'Failed to export contracts' });
  }
});

module.exports = router;
