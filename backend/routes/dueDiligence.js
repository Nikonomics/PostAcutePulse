const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getSequelizeInstance } = require('../config/database');
const { UPLOAD_DIR } = require('../services/fileStorage');

// Helper to run queries
const runQuery = async (sql, params = []) => {
  const sequelize = getSequelizeInstance();
  try {
    const [results] = await sequelize.query(sql, { replacements: params });
    return results;
  } finally {
    await sequelize.close();
  }
};

const runQuerySingle = async (sql, params = []) => {
  const results = await runQuery(sql, params);
  return results[0] || null;
};

const runInsert = async (sql, params = []) => {
  const sequelize = getSequelizeInstance();
  try {
    const [results, metadata] = await sequelize.query(sql + ' RETURNING id', { replacements: params });
    return { lastID: results[0]?.id };
  } finally {
    await sequelize.close();
  }
};

const runUpdate = async (sql, params = []) => {
  const sequelize = getSequelizeInstance();
  try {
    const [results, metadata] = await sequelize.query(sql, { replacements: params });
    return { changes: metadata?.rowCount || 0 };
  } finally {
    await sequelize.close();
  }
};

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Upload directory - use UPLOAD_DIR for persistent disk support on Render
const uploadDir = path.join(UPLOAD_DIR, 'due-diligence');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
console.log('[DueDiligence] Using upload directory:', uploadDir);

// Initialize database tables
const initDb = async () => {
  try {
    // Due Diligence Projects table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS due_diligence_projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'Active Due Diligence',
        avg_compliance_score FLOAT,
        total_contracts INTEGER DEFAULT 0,
        analyzed_contracts INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Analyzed Contracts table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS dd_analyzed_contracts (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(500),
        contract_type VARCHAR(100),
        risk_rating VARCHAR(50),
        compliance_score INTEGER,
        composite_risk_score FLOAT,
        analysis_summary TEXT,
        extracted_terms TEXT,
        category_scores TEXT,
        recommended_changes TEXT,
        raw_analysis TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES due_diligence_projects(id) ON DELETE CASCADE
      )
    `);

    console.log('Due Diligence tables initialized');
  } catch (error) {
    console.error('Error initializing due diligence tables:', error);
  }
};

// Initialize tables on module load
initDb();

// Risk scoring prompt
const RISK_SCORING_PROMPT = `You are a Contract Compliance & Risk Analyst for a healthcare organization.
You will receive the full text of one vendor contract.
Your job is to:
1. Extract the key commercial and legal terms.
2. Evaluate the contract against the organization's Compliance Framework.
3. Score each of the 10 risk categories using a weighted methodology.
4. Calculate a 0–100 Composite Risk Score, where higher = riskier.
5. For EACH finding, include the exact quote from the contract as source text.
6. Deliver the analysis in a structured JSON format.

COMPLIANCE FRAMEWORK
Below are the rules you must apply when scoring the contract.

WEIGHTED RISK CATEGORIES (Total Weight = 35)
(You must use these exact weights and scoring rules.)

1. Data Security / HIPAA Clause (Weight 5)
   0 = clear HIPAA/privacy language; 0.5 = generic confidentiality but no explicit HIPAA; 1 = missing or inadequate security/privacy language

2. One-Sided Indemnification (Weight 5)
   0 = mutual indemnification; 0.5 = mostly mutual with carve-outs; 1 = one-sided (facility indemnifies vendor only)

3. Limitation of Liability (Weight 5)
   0 = reasonable cap (~1× annual fees), standard exclusions; 0.5 = cap exists but is high (≥2× fees) or overly broad exclusions; 1 = missing OR unlimited vendor liability

4. Unilateral Vendor Amendments (Weight 4)
   0 = no unilateral changes; 0.5 = unilateral for minor items (policies), but not pricing; 1 = vendor can change pricing or material terms unilaterally

5. Confidentiality Clause (Weight 3)
   0 = mutual confidentiality; 0.5 = weak or one-sided confidentiality; 1 = missing

6. Personal Guarantees (Weight 3)
   0 = none required; 0.5 = optional or narrowly scoped; 1 = required personal guarantee

7. Required "Out" Clause / Termination for Convenience (Weight 3)
   Standard: 30 days notice. 0 = ≤30 days; 0.5 = 31–90 days; 1 = >90 days OR no termination for convenience

8. Minimum Cure Period (Weight 3)
   Standard: ≥30 days. 0 = ≥30 days; 0.5 = 15–29 days; 1 = <15 days OR no cure period

9. Max Down Payment % (Weight 2)
   Standard: ≤10%. 0 = ≤10%; 0.5 = 11–25%; 1 = >25%

10. Max Late Fee % Monthly (Weight 2)
    Standard: ≤5%. 0 = ≤5%; 0.5 = 6–10%; 1 = >10%

HOW TO CALCULATE THE COMPOSITE SCORE
For each category i:
- Assign risk sub-score ri = 0, 0.5, or 1
- Multiply by weight wi
- Sum all weighted values
Then: Composite Risk Score (0–100) = (Sum(wi × ri) / 35) × 100

RISK INTERPRETATION
- 0–20 → LOW RISK (Green)
- 21–50 → MEDIUM RISK (Yellow)
- 51–100 → HIGH RISK (Red)

COMPLIANCE SCORE
The Compliance Score is the inverse: Compliance Score = 100 - Composite Risk Score

IMPORTANT: For each category_score and extracted_term, you MUST include:
- "source_text": The exact quote from the contract (verbatim, 1-3 sentences max)
- If no relevant clause exists, use "source_text": "No relevant clause found"

Return ONLY a valid JSON object with this exact structure (no markdown, no extra text):
{
  "summary": {
    "bullets": ["bullet 1", "bullet 2", "bullet 3"],
    "contract_type": "Type of contract (e.g., Insurance, Vendor Agreement, Service Agreement, etc.)"
  },
  "extracted_terms": {
    "annual_contract_value": {"value": "value or N/A", "source_text": "exact quote from contract"},
    "liability_cap": {"value": "description or N/A", "source_text": "exact quote"},
    "down_payment_percent": {"value": "X% or N/A", "source_text": "exact quote"},
    "late_fee_percent": {"value": "X% or N/A", "source_text": "exact quote"},
    "termination_for_convenience": {"value": "Yes/No + notice days", "source_text": "exact quote"},
    "cure_period_days": {"value": "X days or N/A", "source_text": "exact quote"},
    "indemnification_structure": {"value": "Mutual / One-sided / N/A", "source_text": "exact quote"},
    "hipaa_language": {"value": "Present / Absent", "source_text": "exact quote"},
    "confidentiality_clause": {"value": "Present / Absent", "source_text": "exact quote"},
    "personal_guarantee": {"value": "Required / Not Required", "source_text": "exact quote"},
    "amendment_clause": {"value": "Mutual / Unilateral", "source_text": "exact quote"}
  },
  "category_scores": [
    {"category": "Data Security / HIPAA", "weight": 5, "score": 0, "explanation": "...", "source_text": "exact quote from contract"},
    {"category": "One-Sided Indemnification", "weight": 5, "score": 0, "explanation": "...", "source_text": "exact quote"},
    {"category": "Limitation of Liability", "weight": 5, "score": 0, "explanation": "...", "source_text": "exact quote"},
    {"category": "Unilateral Vendor Amendments", "weight": 4, "score": 0, "explanation": "...", "source_text": "exact quote"},
    {"category": "Confidentiality Clause", "weight": 3, "score": 0, "explanation": "...", "source_text": "exact quote"},
    {"category": "Personal Guarantees", "weight": 3, "score": 0, "explanation": "...", "source_text": "exact quote"},
    {"category": "Termination for Convenience", "weight": 3, "score": 0, "explanation": "...", "source_text": "exact quote"},
    {"category": "Minimum Cure Period", "weight": 3, "score": 0, "explanation": "...", "source_text": "exact quote"},
    {"category": "Max Down Payment", "weight": 2, "score": 0, "explanation": "...", "source_text": "exact quote"},
    {"category": "Max Late Fee", "weight": 2, "score": 0, "explanation": "...", "source_text": "exact quote"}
  ],
  "composite_risk_score": 0,
  "compliance_score": 100,
  "risk_level": "Low/Medium/High",
  "risk_explanation": "3-5 sentence explanation of the overall risk assessment",
  "recommended_changes": ["change 1", "change 2", "change 3"]
}`;

// ============================================
// DUE DILIGENCE PROJECTS
// ============================================

// GET /api/due-diligence/projects - Get all projects
router.get('/projects', async (req, res) => {
  try {
    const projects = await runQuery(`
      SELECT id, name, description, status, avg_compliance_score,
             total_contracts, analyzed_contracts, created_at, updated_at
      FROM due_diligence_projects
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      body: {
        data: projects,
        total: projects.length
      }
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/due-diligence/projects/:id - Get single project with contracts
router.get('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const project = await runQuerySingle(`
      SELECT * FROM due_diligence_projects WHERE id = ?
    `, [id]);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const contracts = await runQuery(`
      SELECT id, filename, contract_type, risk_rating, compliance_score,
             composite_risk_score, analysis_summary, status, created_at
      FROM dd_analyzed_contracts
      WHERE project_id = ?
      ORDER BY created_at DESC
    `, [id]);

    res.json({
      success: true,
      body: {
        project: project,
        contracts: contracts
      }
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/due-diligence/projects - Create new project
router.post('/projects', async (req, res) => {
  try {
    const { name, description, status } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Project name is required' });
    }

    const result = await runInsert(`
      INSERT INTO due_diligence_projects (name, description, status)
      VALUES (?, ?, ?)
    `, [name, description || '', status || 'Active Due Diligence']);

    const project = await runQuerySingle('SELECT * FROM due_diligence_projects WHERE id = ?', [result.lastID]);

    res.json({
      success: true,
      body: project
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/due-diligence/projects/:id - Update project
router.put('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;

    await runUpdate(`
      UPDATE due_diligence_projects
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, description, status, id]);

    const project = await runQuerySingle('SELECT * FROM due_diligence_projects WHERE id = ?', [id]);

    res.json({
      success: true,
      body: project
    });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/due-diligence/projects/:id - Delete project
router.delete('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Delete associated contracts first
    await runUpdate('DELETE FROM dd_analyzed_contracts WHERE project_id = ?', [id]);

    // Delete project
    await runUpdate('DELETE FROM due_diligence_projects WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// CONTRACT ANALYSIS
// ============================================

// Helper function to convert file to base64
const fileToBase64 = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) reject(err);
      else resolve(data.toString('base64'));
    });
  });
};

// Helper function to analyze a single contract
const analyzeContract = async (filePath, filename) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Read file and convert to base64
    const base64Data = await fileToBase64(filePath);

    // First, extract text from the PDF
    const textExtractionResult = await model.generateContent([
      'Extract all text content from this PDF document. Return only the extracted text.',
      {
        inlineData: {
          data: base64Data,
          mimeType: 'application/pdf',
        },
      },
    ]);

    const extractedText = textExtractionResult.response.text();

    // Now analyze with the risk scoring prompt
    const analysisResult = await model.generateContent([
      RISK_SCORING_PROMPT + '\n\nContract text:\n' + extractedText
    ]);

    const responseText = analysisResult.response.text();

    // Try to extract JSON from response
    let jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const analysis = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          analysis: analysis,
          extractedText: extractedText
        };
      } catch (e) {
        console.error('Failed to parse analysis JSON:', e);
        return {
          success: false,
          error: 'Failed to parse analysis response',
          rawResponse: responseText
        };
      }
    }

    return {
      success: false,
      error: 'No valid JSON in response',
      rawResponse: responseText
    };
  } catch (error) {
    console.error('Error analyzing contract:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Helper function to determine risk rating from score
const getRiskRating = (complianceScore) => {
  if (complianceScore === null || complianceScore === undefined) return 'Unknown Risk';
  if (complianceScore >= 80) return 'Green Risk';
  if (complianceScore >= 50) return 'Yellow Risk';
  return 'Red Risk';
};

// Helper function to update project statistics
const updateProjectStats = async (projectId) => {
  const stats = await runQuerySingle(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as analyzed,
      AVG(CASE WHEN compliance_score IS NOT NULL THEN compliance_score ELSE NULL END) as avg_score
    FROM dd_analyzed_contracts
    WHERE project_id = ?
  `, [projectId]);

  await runUpdate(`
    UPDATE due_diligence_projects
    SET total_contracts = ?,
        analyzed_contracts = ?,
        avg_compliance_score = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [stats.total, stats.analyzed, stats.avg_score, projectId]);
};

// POST /api/due-diligence/projects/:id/upload - Upload and analyze contracts
router.post('/projects/:id/upload', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Upload endpoint hit - project:', id);
    console.log('req.files:', req.files);

    // express-fileupload puts files in req.files
    if (!req.files || !req.files.files) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    // Handle single file or array of files
    let files = req.files.files;
    if (!Array.isArray(files)) {
      files = [files];
    }

    console.log('Files to process:', files.length);

    // Check project exists
    const project = await runQuerySingle('SELECT id FROM due_diligence_projects WHERE id = ?', [id]);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Save files and insert contracts as pending
    const contractIds = [];
    const savedFiles = [];

    for (const file of files) {
      // Only accept PDFs
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        console.log('Skipping non-PDF:', file.name);
        continue;
      }

      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const filename = uniqueSuffix + '-' + file.name;
      const filePath = path.join(uploadDir, filename);

      // Save file to disk
      await file.mv(filePath);
      console.log('Saved file:', filePath);

      const result = await runInsert(`
        INSERT INTO dd_analyzed_contracts (project_id, filename, file_path, status)
        VALUES (?, ?, ?, 'pending')
      `, [id, file.name, filePath]);

      contractIds.push(result.lastID);
      savedFiles.push({ id: result.lastID, path: filePath, name: file.name });
    }

    if (contractIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid PDF files found' });
    }

    // Update project stats
    await updateProjectStats(id);

    // Start analysis in background
    (async () => {
      for (const file of savedFiles) {
        try {
          // Update status to analyzing
          await runUpdate(`
            UPDATE dd_analyzed_contracts SET status = 'analyzing' WHERE id = ?
          `, [file.id]);

          console.log('Analyzing:', file.name);
          const result = await analyzeContract(file.path, file.name);

          if (result.success) {
            const analysis = result.analysis;
            await runUpdate(`
              UPDATE dd_analyzed_contracts
              SET contract_type = ?,
                  risk_rating = ?,
                  compliance_score = ?,
                  composite_risk_score = ?,
                  analysis_summary = ?,
                  extracted_terms = ?,
                  category_scores = ?,
                  recommended_changes = ?,
                  raw_analysis = ?,
                  status = 'completed',
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [
              analysis.summary?.contract_type || 'Unknown',
              getRiskRating(analysis.compliance_score),
              analysis.compliance_score,
              analysis.composite_risk_score,
              JSON.stringify(analysis.summary),
              JSON.stringify(analysis.extracted_terms),
              JSON.stringify(analysis.category_scores),
              JSON.stringify(analysis.recommended_changes),
              JSON.stringify(analysis),
              file.id
            ]);
            console.log('Analysis complete for:', file.name);
          } else {
            console.log('Analysis failed for:', file.name, result.error);
            await runUpdate(`
              UPDATE dd_analyzed_contracts
              SET status = 'error',
                  error_message = ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [result.error, file.id]);
          }
        } catch (err) {
          console.error('Error processing contract:', file.name, err);
          await runUpdate(`
            UPDATE dd_analyzed_contracts
            SET status = 'error',
                error_message = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [err.message, file.id]);
        }

        // Update project stats after each contract
        await updateProjectStats(id);
      }
      console.log('All analysis complete for project:', id);
    })();

    res.json({
      success: true,
      message: `${contractIds.length} files uploaded. Analysis started.`,
      body: {
        contractIds: contractIds,
        totalFiles: contractIds.length
      }
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/due-diligence/contracts/:id/pdf - Serve the PDF file
router.get('/contracts/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;

    const contract = await runQuerySingle('SELECT file_path, filename FROM dd_analyzed_contracts WHERE id = ?', [id]);

    if (!contract) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    if (!contract.file_path || !fs.existsSync(contract.file_path)) {
      return res.status(404).json({ success: false, message: 'PDF file not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${contract.filename}"`);
    res.sendFile(contract.file_path);
  } catch (error) {
    console.error('Error serving PDF:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/due-diligence/contracts/:id - Get single contract details
router.get('/contracts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const contract = await runQuerySingle(`
      SELECT * FROM dd_analyzed_contracts WHERE id = ?
    `, [id]);

    if (!contract) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    // Parse JSON fields
    if (contract.analysis_summary) {
      try { contract.analysis_summary = JSON.parse(contract.analysis_summary); } catch (e) {}
    }
    if (contract.extracted_terms) {
      try { contract.extracted_terms = JSON.parse(contract.extracted_terms); } catch (e) {}
    }
    if (contract.category_scores) {
      try { contract.category_scores = JSON.parse(contract.category_scores); } catch (e) {}
    }
    if (contract.recommended_changes) {
      try { contract.recommended_changes = JSON.parse(contract.recommended_changes); } catch (e) {}
    }
    if (contract.raw_analysis) {
      try { contract.raw_analysis = JSON.parse(contract.raw_analysis); } catch (e) {}
    }

    res.json({
      success: true,
      body: contract
    });
  } catch (error) {
    console.error('Error fetching contract:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/due-diligence/contracts/:id - Delete a contract
router.delete('/contracts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const contract = await runQuerySingle('SELECT project_id, file_path FROM dd_analyzed_contracts WHERE id = ?', [id]);

    if (!contract) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    // Delete file if exists
    if (contract.file_path && fs.existsSync(contract.file_path)) {
      fs.unlinkSync(contract.file_path);
    }

    await runUpdate('DELETE FROM dd_analyzed_contracts WHERE id = ?', [id]);

    // Update project stats
    await updateProjectStats(contract.project_id);

    res.json({
      success: true,
      message: 'Contract deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting contract:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/due-diligence/contracts/:id/reanalyze - Re-analyze a contract
router.post('/contracts/:id/reanalyze', async (req, res) => {
  try {
    const { id } = req.params;

    const contract = await runQuerySingle('SELECT * FROM dd_analyzed_contracts WHERE id = ?', [id]);

    if (!contract) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    if (!contract.file_path || !fs.existsSync(contract.file_path)) {
      return res.status(400).json({ success: false, message: 'Contract file not found' });
    }

    // Update status to analyzing
    await runUpdate(`UPDATE dd_analyzed_contracts SET status = 'analyzing' WHERE id = ?`, [id]);

    // Start analysis in background
    (async () => {
      try {
        const result = await analyzeContract(contract.file_path, contract.filename);

        if (result.success) {
          const analysis = result.analysis;
          await runUpdate(`
            UPDATE dd_analyzed_contracts
            SET contract_type = ?,
                risk_rating = ?,
                compliance_score = ?,
                composite_risk_score = ?,
                analysis_summary = ?,
                extracted_terms = ?,
                category_scores = ?,
                recommended_changes = ?,
                raw_analysis = ?,
                status = 'completed',
                error_message = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [
            analysis.summary?.contract_type || 'Unknown',
            getRiskRating(analysis.compliance_score),
            analysis.compliance_score,
            analysis.composite_risk_score,
            JSON.stringify(analysis.summary),
            JSON.stringify(analysis.extracted_terms),
            JSON.stringify(analysis.category_scores),
            JSON.stringify(analysis.recommended_changes),
            JSON.stringify(analysis),
            id
          ]);
        } else {
          await runUpdate(`
            UPDATE dd_analyzed_contracts
            SET status = 'error',
                error_message = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [result.error, id]);
        }

        await updateProjectStats(contract.project_id);
      } catch (err) {
        await runUpdate(`
          UPDATE dd_analyzed_contracts
          SET status = 'error',
              error_message = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [err.message, id]);
      }
    })();

    res.json({
      success: true,
      message: 'Re-analysis started'
    });
  } catch (error) {
    console.error('Error re-analyzing contract:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/due-diligence/projects/:id/seed - Seed demo contracts
router.post('/projects/:id/seed', async (req, res) => {
  try {
    const { id } = req.params;

    // Check project exists
    const project = await runQuerySingle('SELECT id FROM due_diligence_projects WHERE id = ?', [id]);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Demo contracts with pre-analyzed data
    const demoContracts = [
      {
        filename: 'Insurance_General_Liability.pdf',
        contract_type: 'Insurance',
        risk_rating: 'Green Risk',
        compliance_score: 90,
        composite_risk_score: 10,
        analysis_summary: JSON.stringify({
          bullets: [
            'General liability insurance policy',
            'Annual premium with standard coverage limits',
            'Clear HIPAA compliance provisions'
          ],
          contract_type: 'Insurance'
        })
      },
      {
        filename: 'MSA_Vendor_Corp.pdf',
        contract_type: 'Vendor Agreement',
        risk_rating: 'Green Risk',
        compliance_score: 95,
        composite_risk_score: 5,
        analysis_summary: JSON.stringify({
          bullets: [
            'Master Service Agreement with equipment vendor',
            'Mutual indemnification clauses',
            '30-day termination for convenience'
          ],
          contract_type: 'Vendor Agreement'
        })
      },
      {
        filename: 'Staffing_Agency_Contract.pdf',
        contract_type: 'Service Agreement',
        risk_rating: 'Yellow Risk',
        compliance_score: 65,
        composite_risk_score: 35,
        analysis_summary: JSON.stringify({
          bullets: [
            'Staffing services agreement',
            '60-day termination notice required',
            'One-sided indemnification favoring vendor'
          ],
          contract_type: 'Service Agreement'
        })
      },
      {
        filename: 'Medical_Supplies_Agreement.pdf',
        contract_type: 'Vendor Agreement',
        risk_rating: 'Green Risk',
        compliance_score: 85,
        composite_risk_score: 15,
        analysis_summary: JSON.stringify({
          bullets: [
            'Medical supplies distribution agreement',
            'Standard payment terms',
            'Mutual confidentiality provisions'
          ],
          contract_type: 'Vendor Agreement'
        })
      },
      {
        filename: 'IT_Services_Contract.pdf',
        contract_type: 'Service Agreement',
        risk_rating: 'Red Risk',
        compliance_score: 45,
        composite_risk_score: 55,
        analysis_summary: JSON.stringify({
          bullets: [
            'IT services and support agreement',
            'No HIPAA-specific language',
            'Vendor can make unilateral pricing changes'
          ],
          contract_type: 'Service Agreement'
        })
      }
    ];

    for (const contract of demoContracts) {
      await runInsert(`
        INSERT INTO dd_analyzed_contracts
        (project_id, filename, contract_type, risk_rating, compliance_score,
         composite_risk_score, analysis_summary, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')
      `, [id, contract.filename, contract.contract_type, contract.risk_rating,
          contract.compliance_score, contract.composite_risk_score, contract.analysis_summary]);
    }

    // Update project stats
    await updateProjectStats(id);

    res.json({
      success: true,
      message: `${demoContracts.length} demo contracts added`
    });
  } catch (error) {
    console.error('Error seeding contracts:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
