const { query } = require("express");
const jwt = require("jsonwebtoken");
const jwtToken = process.env.JWT_SECRET;
const bcrypt = require("bcryptjs");
let helper = require("../config/helper");
const db = require("../models");
const sequelize = require("sequelize");
const Op = sequelize.Op;

// Helper function for cross-database date difference calculation
const getDateDiffLiteral = (col1, col2) => {
  const dialect = db.sequelize.getDialect();
  if (dialect === 'postgres') {
    // PostgreSQL: subtract dates and extract days
    return sequelize.literal(`EXTRACT(DAY FROM "${col1}" - "${col2}")`);
  } else {
    // SQLite: use julianday
    return sequelize.literal(`CAST(julianday("${col1}") - julianday("${col2}") AS INTEGER)`);
  }
};
const { sendBrevoEmail } = require("../config/sendMail");
const { extractDealFromDocument, extractFromMultipleDocuments } = require("../services/aiExtractor");
const { saveFiles, getFile, getDealFiles } = require("../services/fileStorage");
const {
  calculateDealMetrics: calcDealMetrics,
  calculatePortfolioMetrics: calcPortfolioMetrics,
  calculateEnhancedMetrics: calcEnhancedMetrics,
  calculateEnhancedPortfolioMetrics: calcEnhancedPortfolioMetrics
} = require("../services/calculatorService");
const {
  calculateProforma,
  generateYearlyProjections,
  normalizeBenchmarkConfig,
  DEFAULT_BENCHMARKS
} = require("../services/proformaService");
const User = db.users;
const Deal = db.deals;
const DealTeamMembers = db.deal_team_members;
const DealExternalAdvisors = db.deal_external_advisors;
const RecentActivity = db.recent_activities;
const DealComments = db.deal_comments;
const CommentMentions = db.comment_mentions;
const UserNotification = db.user_notifications;
const DealDocuments = db.deal_documents;
const MasterDeals = db.master_deals;
const DealFacilities = db.deal_facilities;
const BenchmarkConfigurations = db.benchmark_configurations;
const DealProformaScenarios = db.deal_proforma_scenarios;
Deal.hasMany(DealTeamMembers, {
  foreignKey: "deal_id",
  as: "deal_team_members",
});
Deal.hasMany(DealExternalAdvisors, {
  foreignKey: "deal_id",
  as: "deal_external_advisors",
});
Deal.hasMany(DealFacilities, {
  foreignKey: "deal_id",
  as: "facilities",
  onDelete: 'CASCADE',
});
DealFacilities.belongsTo(Deal, {
  foreignKey: "deal_id",
  as: "deal",
});
Deal.belongsTo(MasterDeals, {
  foreignKey: "master_deal_id",
  as: "master_deal",
});
MasterDeals.hasMany(Deal, {
  foreignKey: "master_deal_id",
  as: "deals",
});
DealTeamMembers.belongsTo(User, { foreignKey: "user_id", as: "user" });
DealExternalAdvisors.belongsTo(User, { foreignKey: "user_id", as: "user" });
Deal.belongsTo(User, { foreignKey: "deal_lead_id", as: "deal_lead" });
Deal.belongsTo(User, {
  foreignKey: "assistant_deal_lead_id",
  as: "assistant_deal_lead",
});
DealComments.belongsTo(User, { foreignKey: "user_id", as: "user" });
DealDocuments.belongsTo(User, { foreignKey: "user_id", as: "user" });
CommentMentions.belongsTo(User, {
  foreignKey: "mentioned_user_id",
  as: "user",
});
DealComments.hasMany(DealComments, { as: "replies", foreignKey: "parent_id" });
DealComments.belongsToMany(User, {
  through: "comment_mentions",
  as: "mentioned_users",
  foreignKey: "comment_id",
  otherKey: "mentioned_user_id",
});

module.exports = {
  createDeal: async (req, res) => {
    try {
      const required = {
        user_id: req.user.id,
        address: req.body.address,
        deals: req.body.deals,
      };
      const nonrequired = {
        priority_level: req.body.priority_level,
        deal_source: req.body.deal_source,
        primary_contact_name: req.body.primary_contact_name,
        title: req.body.title,
        phone_number: req.body.phone_number,
        email: req.body.email,
        target_close_date: req.body.target_close_date,
        dd_period_weeks: req.body.dd_period_weeks,
        price_per_bed: req.body.price_per_bed ? req.body.price_per_bed : 0,
        down_payment: req.body.down_payment ? req.body.down_payment : 0,
        financing_amount: req.body.financing_amount
          ? req.body.financing_amount
          : 0,
        revenue_multiple: req.body.revenue_multiple
          ? req.body.revenue_multiple
          : 0,
        ebitda: req.body.ebitda ? req.body.ebitda : 0,
        ebitda_multiple: req.body.ebitda_multiple
          ? req.body.ebitda_multiple
          : 0,
        ebitda_margin: req.body.ebitda_margin ? req.body.ebitda_margin : 0,
        net_operating_income: req.body.net_operating_income
          ? req.body.net_operating_income
          : 0,
        current_occupancy: req.body.current_occupancy
          ? req.body.current_occupancy
          : 0,
        average_daily_rate: req.body.average_daily_rate
          ? req.body.average_daily_rate
          : 0,
        medicare_percentage: req.body.medicare_percentage
          ? req.body.medicare_percentage
          : 0,
        private_pay_percentage: req.body.private_pay_percentage
          ? req.body.private_pay_percentage
          : 0,
        target_irr_percentage: req.body.target_irr_percentage
          ? req.body.target_irr_percentage
          : 0,
        target_hold_period: req.body.target_hold_period
          ? req.body.target_hold_period
          : 0,
        projected_cap_rate_percentage: req.body.projected_cap_rate_percentage
          ? req.body.projected_cap_rate_percentage
          : 0,
        exit_multiple: req.body.exit_multiple ? req.body.exit_multiple : 0,
        assistant_deal_lead_id: req.body.assistant_deal_lead_id,
        deal_team_members: req.body.deal_team_members,
        deal_external_advisors: req.body.deal_external_advisors,
        deal_status: req.body.deal_status,
        documents: req.body.documents, // Array of uploaded documents from extraction
        extraction_data: req.body.extraction_data, // Raw AI extraction data for analysis view
      };
      const requiredData = await helper.validateObject(required, nonrequired);

      // creating master deal:
      const masterDeal = await MasterDeals.create({
        unique_id: helper.generateUniqueId(),
        user_id: requiredData.user_id,
        street_address: requiredData.address.street_address,
        city: requiredData.address.city,
        state: requiredData.address.state,
        country: requiredData.address.country,
        zip_code: requiredData.address.zip_code,
      });

      let dealData = [];
      // creating multiple deal data:
      if (requiredData.deals && requiredData.deals.length > 0) {
        dealData = await Promise.all(
          requiredData.deals.map(async (deal) => {
            const allUserIds = new Set();
            deal.email_notification_major_updates =
              deal.notificationSettings.email_notification_major_updates ===
              true
                ? "yes"
                : "no";
            deal.document_upload_notification =
              deal.notificationSettings.document_upload_notification === true
                ? "yes"
                : "no";
            deal.target_close_date = deal.target_close_date
              ? deal.target_close_date
              : null;
            deal.price_per_bed = deal.price_per_bed ? deal.price_per_bed : 0;
            deal.down_payment = deal.down_payment ? deal.down_payment : 0;
            deal.financing_amount = deal.financing_amount
              ? deal.financing_amount
              : 0;
            deal.revenue_multiple = deal.revenue_multiple
              ? deal.revenue_multiple
              : 0;
            deal.ebitda = deal.ebitda ? deal.ebitda : 0;
            deal.ebitda_multiple = deal.ebitda_multiple
              ? deal.ebitda_multiple
              : 0;
            deal.ebitda_margin = deal.ebitda_margin ? deal.ebitda_margin : 0;
            deal.net_operating_income = deal.net_operating_income
              ? deal.net_operating_income
              : 0;
            deal.current_occupancy = deal.current_occupancy
              ? deal.current_occupancy
              : 0;
            deal.average_daily_rate = deal.average_daily_rate
              ? deal.average_daily_rate
              : 0;
            deal.medicare_percentage = deal.medicare_percentage
              ? deal.medicare_percentage
              : 0;
            deal.private_pay_percentage = deal.private_pay_percentage
              ? deal.private_pay_percentage
              : 0;
            deal.target_irr_percentage = deal.target_irr_percentage
              ? deal.target_irr_percentage
              : 0;
            deal.target_hold_period = deal.target_hold_period
              ? deal.target_hold_period
              : 0;
            deal.projected_cap_rate_percentage =
              deal.projected_cap_rate_percentage
                ? deal.projected_cap_rate_percentage
                : 0;
            deal.exit_multiple = deal.exit_multiple ? deal.exit_multiple : 0;

            // create deal:
            // Get index to check if this is the first deal (for extraction_data)
            const dealIndex = requiredData.deals.indexOf(deal);

            const dealCreated = await Deal.create({
              ...deal,
              user_id: requiredData.user_id,
              master_deal_id: masterDeal.id,
              // Only store extraction_data on the first deal
              extraction_data: dealIndex === 0 ? requiredData.extraction_data : null,
            });

            // create recent activity for admin:
            const admin = await User.findByPk(1);
            const dealCreatedBy = await User.findByPk(requiredData.user_id);
            await RecentActivity.create({
              to_id: admin.id,
              from_id: dealCreated.user_id,
              subject_type: "deal",
              subject_id: dealCreated.id,
              action: "new_deal_created",
              message: `A new deal <strong>${dealCreated.deal_name}</strong> has been created by <strong>${dealCreatedBy.first_name} ${dealCreatedBy.last_name}</strong> on our platform.`,
              data: JSON.stringify({
                deal_id: dealCreated.id,
                deal_name: dealCreated.deal_name,
                to_id: admin.id,
                from_id: dealCreated.user_id,
              }),
            });

            // append all user to allUserIds:
            allUserIds.add(dealCreated?.deal_lead_id);
            allUserIds.add(dealCreated?.assistant_deal_lead_id);
            
            // Fixed: Create deal team members from the current deal's data
            if (deal.deal_team_members && deal.deal_team_members.length > 0) {
              await Promise.all(
                deal.deal_team_members.map(async (element) => {
                  const dealTeamMember = await DealTeamMembers.create({
                    deal_id: dealCreated.id,
                    user_id: element.id,
                  });
                  allUserIds.add(element.id);
                })
              );
            }
            
            // Fixed: Create deal external advisors from the current deal's data
            if (deal.deal_external_advisors && deal.deal_external_advisors.length > 0) {
              await Promise.all(
                deal.deal_external_advisors.map(async (element) => {
                  const dealExternalAdvisor = await DealExternalAdvisors.create({
                    deal_id: dealCreated.id,
                    user_id: element.id,
                  });
                  allUserIds.add(element.id);
                })
              );
            }

            // send email:
            await Promise.all(
              [...allUserIds].map(async (userId) => {
                const user = await User.findByPk(userId);
                if (user) {
                  await sendBrevoEmail({
                    receiver_email: user.email,
                    receiver_name: user.first_name + " " + user.last_name,
                    subject: "You've been added to a new deal",
                    htmlContent: `
      <p>Hi ${user.first_name} ${user.last_name},</p>
      <p>You've been added to the deal <strong>${deal.deal_name}</strong> on our platform.</p>
      <p>You can now collaborate, view details, and track progress in your dashboard.</p>
      <p>Best regards.</p>
    `,
                  });

                  // create recent activity:
                  await RecentActivity.create({
                    to_id: userId,
                    from_id: dealCreated.user_id,
                    subject_type: "deal",
                    subject_id: dealCreated.id,
                    action: "added_to_deal",
                    message: `You've been added to the deal <strong>${dealCreated.deal_name}</strong> on our platform.`,
                    data: JSON.stringify({
                      deal_id: dealCreated.id,
                      deal_name: dealCreated.deal_name,
                      to_id: userId,
                      from_id: dealCreated.user_id,
                    }),
                  });
                }
              })
            );

            return dealCreated;
          })
        );
      }

      // Save uploaded documents from extraction (associate with the first deal created)
      if (requiredData.documents && requiredData.documents.length > 0 && dealData.length > 0) {
        const firstDealId = dealData[0].id;
        await Promise.all(
          requiredData.documents.map(async (doc) => {
            await DealDocuments.create({
              deal_id: firstDealId,
              user_id: requiredData.user_id,
              document_url: doc.file_path || doc.url,
              document_name: doc.original_name || doc.filename,
            });
          })
        );
      }

      // Save extracted facilities from AI extraction (if present)
      if (req.body.extracted_facilities && req.body.extracted_facilities.length > 0 && dealData.length > 0) {
        const firstDealId = dealData[0].id;
        await Promise.all(
          req.body.extracted_facilities.map(async (facility, index) => {
            await DealFacilities.create({
              deal_id: firstDealId,
              facility_name: facility.facility_name,
              facility_type: facility.facility_type,
              address: facility.address,
              city: facility.city,
              state: facility.state,
              zip_code: facility.zip_code,
              county: facility.county,
              total_beds: facility.total_beds,
              licensed_beds: facility.licensed_beds,
              certified_beds: facility.certified_beds,
              purchase_price: facility.purchase_price,
              annual_revenue: facility.annual_revenue,
              ebitda: facility.ebitda,
              ebitdar: facility.ebitdar,
              noi: facility.noi,
              annual_rent: facility.annual_rent,
              occupancy_rate: facility.occupancy_rate,
              medicare_mix: facility.medicare_mix,
              medicaid_mix: facility.medicaid_mix,
              private_pay_mix: facility.private_pay_mix,
              managed_care_mix: facility.managed_care_mix,
              notes: facility.notes,
              extraction_data: JSON.stringify(facility.extraction_data || facility),
              display_order: index,
            });
          })
        );
      }

      // return the success response:
      return helper.success(res, "Deal created successfully", {
        masterDeal,
        dealData,
      });
    } catch (err) {
      return helper.error(res, err);
    }
  },
 
  updateMasterDeal: async (req, res) => {
    try {
      const required = {
        master_deal_id: req.body.master_deal_id,
      };
  
      const nonrequired = {
        deal_name: req.body.deal_name,
        deal_type: req.body.deal_type,
        deal_status: req.body.deal_status,
        priority_level: req.body.priority_level,
        deal_source: req.body.deal_source,
        primary_contact_name: req.body.primary_contact_name,
        title: req.body.title,
        phone_number: req.body.phone_number,
        email: req.body.email,
        target_close_date: req.body.target_close_date,
        dd_period_weeks: req.body.dd_period_weeks,
        price_per_bed: req.body.price_per_bed || 0,
        down_payment: req.body.down_payment || 0,
        financing_amount: req.body.financing_amount || 0,
        revenue_multiple: req.body.revenue_multiple || 0,
        ebitda: req.body.ebitda || 0,
        ebitda_multiple: req.body.ebitda_multiple || 0,
        ebitda_margin: req.body.ebitda_margin || 0,
        net_operating_income: req.body.net_operating_income || 0,
        current_occupancy: req.body.current_occupancy || 0,
        average_daily_rate: req.body.average_daily_rate || 0,
        medicare_percentage: req.body.medicare_percentage || 0,
        private_pay_percentage: req.body.private_pay_percentage || 0,
        target_irr_percentage: req.body.target_irr_percentage || 0,
        target_hold_period: req.body.target_hold_period || 0,
        projected_cap_rate_percentage: req.body.projected_cap_rate_percentage || 0,
        exit_multiple: req.body.exit_multiple || 0,
        deal_lead_id: req.body.deal_lead_id,
        assistant_deal_lead_id: req.body.assistant_deal_lead_id,
        email_notification_major_updates: req.body.email_notification_major_updates,
        document_upload_notification: req.body.document_upload_notification,
        address: req.body.address,
        deals: req.body.deals, // array of deals for update/create
      };
  
      const requiredData = await helper.validateObject(required, nonrequired);
  
      // Find master deal
      const existingMasterDeal = await MasterDeals.findByPk(requiredData.master_deal_id);
      if (!existingMasterDeal) {
        return helper.error(res, "Master deal not found");
      }
  
      // Prepare update payload
      const masterDealUpdateData = {
        deal_name: requiredData.deal_name,
        deal_type: requiredData.deal_type,
        deal_status: requiredData.deal_status,
        priority_level: requiredData.priority_level,
        deal_source: requiredData.deal_source,
        primary_contact_name: requiredData.primary_contact_name,
        title: requiredData.title,
        phone_number: requiredData.phone_number,
        email: requiredData.email,
        target_close_date: requiredData.target_close_date,
        dd_period_weeks: requiredData.dd_period_weeks,
        price_per_bed: requiredData.price_per_bed,
        down_payment: requiredData.down_payment,
        financing_amount: requiredData.financing_amount,
        revenue_multiple: requiredData.revenue_multiple,
        ebitda: requiredData.ebitda,
        ebitda_multiple: requiredData.ebitda_multiple,
        ebitda_margin: requiredData.ebitda_margin,
        net_operating_income: requiredData.net_operating_income,
        current_occupancy: requiredData.current_occupancy,
        average_daily_rate: requiredData.average_daily_rate,
        medicare_percentage: requiredData.medicare_percentage,
        private_pay_percentage: requiredData.private_pay_percentage,
        target_irr_percentage: requiredData.target_irr_percentage,
        target_hold_period: requiredData.target_hold_period,
        projected_cap_rate_percentage: requiredData.projected_cap_rate_percentage,
        exit_multiple: requiredData.exit_multiple,
        deal_lead_id: requiredData.deal_lead_id,
        assistant_deal_lead_id: requiredData.assistant_deal_lead_id,
        email_notification_major_updates: requiredData.email_notification_major_updates,
        document_upload_notification: requiredData.document_upload_notification,
      };
  
      // Add address fields if provided
      if (requiredData.address) {
        Object.assign(masterDealUpdateData, {
          street_address: requiredData.address.street_address,
          city: requiredData.address.city,
          state: requiredData.address.state,
          country: requiredData.address.country,
          zip_code: requiredData.address.zip_code,
        });
      }
  
      // Update master deal
      await MasterDeals.update(masterDealUpdateData, { where: { id: requiredData.master_deal_id } });
  
      // Handle deals (update existing or create new ones)
      if (requiredData.deals && requiredData.deals.length > 0) {
        await Promise.all(
          requiredData.deals.map(async (deal) => {
            const payload = {
              ...deal,
              email_notification_major_updates:
                deal.notificationSettings?.email_notification_major_updates ? "yes" : "no",
              document_upload_notification:
                deal.notificationSettings?.document_upload_notification ? "yes" : "no",
              target_close_date: deal.target_close_date || null,
              price_per_bed: deal.price_per_bed || 0,
              down_payment: deal.down_payment || 0,
              financing_amount: deal.financing_amount || 0,
              revenue_multiple: deal.revenue_multiple || 0,
              ebitda: deal.ebitda || 0,
              ebitda_multiple: deal.ebitda_multiple || 0,
              ebitda_margin: deal.ebitda_margin || 0,
              net_operating_income: deal.net_operating_income || 0,
              current_occupancy: deal.current_occupancy || 0,
              average_daily_rate: deal.average_daily_rate || 0,
              medicare_percentage: deal.medicare_percentage || 0,
              private_pay_percentage: deal.private_pay_percentage || 0,
              target_irr_percentage: deal.target_irr_percentage || 0,
              target_hold_period: deal.target_hold_period || 0,
              projected_cap_rate_percentage: deal.projected_cap_rate_percentage || 0,
              exit_multiple: deal.exit_multiple || 0,
            };
  
            if (deal.id) {
              // Update existing deal
              await Deal.update(payload, { where: { id: deal.id } });
              await DealTeamMembers.destroy({ where: { deal_id: deal.id } });
              await DealExternalAdvisors.destroy({ where: { deal_id: deal.id } });
            } else {
              // Create new deal under the master deal
              const createdDeal = await Deal.create({
                ...payload,
                master_deal_id: requiredData.master_deal_id,
                user_id: req.user.id,
              });
              deal.id = createdDeal.id;
            }
  
            // Add team members
            if (deal.deal_team_members?.length > 0) {
              await Promise.all(
                deal.deal_team_members.map((member) =>
                  DealTeamMembers.create({
                    deal_id: deal.id,
                    user_id: member.id || member.user_id,
                  })
                )
              );
            }
  
            // Add external advisors
            if (deal.deal_external_advisors?.length > 0) {
              await Promise.all(
                deal.deal_external_advisors.map((advisor) =>
                  DealExternalAdvisors.create({
                    deal_id: deal.id,
                    user_id: advisor.id || advisor.user_id,
                  })
                )
              );
            }
          })
        );
      }
  
      // Fetch updated master deal
      const updatedMasterDeal = await MasterDeals.findByPk(requiredData.master_deal_id, {
        include: [
          {
            model: Deal,
            as: "deals",
            include: [
              { model: User, as: "deal_lead", attributes: ["id", "first_name", "last_name", "profile_url"] },
              { model: User, as: "assistant_deal_lead", attributes: ["id", "first_name", "last_name", "profile_url"] },
              {
                model: DealTeamMembers,
                as: "deal_team_members",
                include: [{ model: User, as: "user", attributes: ["id", "first_name", "last_name", "profile_url"] }],
              },
              {
                model: DealExternalAdvisors,
                as: "deal_external_advisors",
                include: [{ model: User, as: "user", attributes: ["id", "first_name", "last_name", "profile_url"] }],
              },
            ],
          },
        ],
      });
  
      // Create recent activity log
      const updatedBy = await User.findByPk(req.user.id);
      await RecentActivity.create({
        to_id: existingMasterDeal.user_id,
        from_id: req.user.id,
        subject_type: "master_deal",
        subject_id: requiredData.master_deal_id,
        action: "master_deal_updated",
        message: `Master deal <strong>${updatedMasterDeal.deal_name}</strong> has been updated by <strong>${updatedBy.first_name} ${updatedBy.last_name}</strong>.`,
        data: JSON.stringify({
          master_deal_id: requiredData.master_deal_id,
          deal_name: updatedMasterDeal.deal_name,
          to_id: existingMasterDeal.user_id,
          from_id: req.user.id,
        }),
      });
  
      return helper.success(res, "Master deal updated successfully", updatedMasterDeal);
    } catch (err) {
      return helper.error(res, err);
    }
  },
  

  getDeal: async (req, res) => {
    try {
      const search = req.query.search;
      const status = req.query.status;
      const type = req.query.type;
      const date = req.query.date;
      const value = req.query.value;
      const page = req.query.page || 1;
      const limit = req.query.limit || 5;
      const offset = (page - 1) * limit;

      const whereClause = {};

      // role based filtering:
      const user = await User.findByPk(req.user.id);

      if (user.role !== "admin") {
        // fetch team member assigned deals:
        const teamMemberDeals = await DealTeamMembers.findAll({
          attributes: ["deal_id"],
          where: { user_id: user.id },
        });

        const teamDealIds = teamMemberDeals.map((entry) => entry.deal_id);

        // fetch external advisor assigned deals:
        const externalAdvisorDeals = await DealExternalAdvisors.findAll({
          attributes: ["deal_id"],
          where: { user_id: user.id },
        });
        const externalAdvisorDealIds = externalAdvisorDeals.map(
          (entry) => entry.deal_id
        );

        whereClause[Op.or] = [
          { user_id: user.id },
          { deal_lead_id: user.id },
          { assistant_deal_lead_id: user.id },
          { id: { [Op.in]: teamDealIds } },
          { id: { [Op.in]: externalAdvisorDealIds } },
        ];
      }

      // Apply search filters
      if (search) {
        whereClause.deal_name = {
          [Op.like]: `%${search}%`,
        };
      }

      if (status && status != "All") {
        whereClause.deal_status = status;
      }

      if (date && date != "All") {
        whereClause.target_close_date = date;
      }

      if (value && value != "All") {
        whereClause.purchase_price = value;
      }

      if (type && type != "All") {
        whereClause.deal_type = type;
      }

      const deal = await Deal.findAll({
        where: whereClause,
        limit: limit,
        offset: offset,
        order: [["created_at", "DESC"]],
        include: [
          { model: User, as: "deal_lead" },
          { model: User, as: "assistant_deal_lead" },
        ],
      });

      const total = await Deal.count({ where: whereClause });
      const totalPages = Math.ceil(total / limit);

      const body = {
        deals: deal,
        total: total,
        totalPages: totalPages,
      };

      return helper.success(res, "Deal fetched successfully", body);
    } catch (err) {
      return helper.error(res, err);
    }
  },

  //fetch master deals:
  getMasterDeals: async (req, res) => {
    try {
      const { page = 1, limit = 10, search = "" } = req.query;

      const user = await User.findByPk(req.user.id);

      const whereClause = {};

      if (user.role !== "admin") {
        whereClause.user_id = user.id;
      }

      if (search) {
        whereClause[Op.or] = [
          { street_address: { [Op.like]: `%${search}%` } },
          { zip_code: { [Op.like]: `%${search}%` } },
          { city: { [Op.like]: `%${search}%` } },
          { state: { [Op.like]: `%${search}%` } },
        ];
      }

      // fetch data:
      const masterDeals = await MasterDeals.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [["created_at", "DESC"]],
      });
      if (masterDeals.length > 0) {
        return helper.success(res, "Master deals fetched successfully", {
          masterDeals: [],
        });
      }
      const responseData = await Promise.all(
        masterDeals.rows.map(async (data) => {
          const deals = await Deal.count({
            where: {
              master_deal_id: data.id,
            },
          });
          return {
            ...data.dataValues,
            deals: deals,
          };
        })
      );

      const body = {
        deals: responseData,
        total: masterDeals.count,
        totalPages: Math.ceil(masterDeals.count / parseInt(limit)),
        currentPage: parseInt(page),
      };

      return helper.success(res, "Master deals fetched successfully", body);
    } catch (error) {
      return helper.error(res, error);
    }
  },

  // get master deal:
  getParticularMasterDeal: async (req, res) => {
    try {
      const required = {
        id: req.query.id,
      };
      const nonrequired = {};
      const requiredData = await helper.validateObject(required, nonrequired);

      const masterDeal = await MasterDeals.findOne({
        where: { id: requiredData.id },
        include: [
          {
            model: Deal,
            as: "deals",
            include: [
              {
                model: User,
                as: "deal_lead",
                attributes: [
                  "id",
                  "first_name",
                  "last_name",
                  "email",
                  "phone_number",
                ],
              },
              {
                model: User,
                as: "assistant_deal_lead",
                attributes: [
                  "id",
                  "first_name",
                  "last_name",
                  "email",
                  "phone_number",
                ],
              },
              {
                model: DealTeamMembers,
                as: "deal_team_members",
                include: [
                  {
                    model: User,
                    as: "user",
                    attributes: [
                      "id",
                      "first_name",
                      "last_name",
                      "profile_url",
                    ],
                  },
                ],
              },
              {
                model: DealExternalAdvisors,
                as: "deal_external_advisors",
                include: [
                  {
                    model: User,
                    as: "user",
                    attributes: [
                      "id",
                      "first_name",
                      "last_name",
                      "profile_url",
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      return helper.success(
        res,
        "Master deal fetched successfully",
        masterDeal
      );
    } catch (error) {
      return helper.error(res, error);
    }
  },

  // delete master deals:
  deleteMasterDeal: async (req, res) => {
    try {
      const required = { id: req.params.id }; // master_deal_id
      const nonrequired = {};
      const requiredData = await helper.validateObject(required, nonrequired);

      // fetch the master deal:
      const masterDeal = await MasterDeals.findByPk(requiredData.id);
      if (!masterDeal) {
        return helper.error(res, "Master deal not found");
      }

      // fetch all deals under this master deal:
      const deals = await Deal.findAll({
        where: { master_deal_id: requiredData.id },
      });

      for (const deal of deals) {
        // delete deal comments:
        await DealComments.destroy({
          where: {
            deal_id: deal.id,
          },
        });

        // delete deal documents:
        await DealDocuments.destroy({ where: { deal_id: deal.id } });

        // delete deal team members:
        await DealTeamMembers.destroy({ where: { deal_id: deal.id } });

        // delete deal external advisors:
        await DealExternalAdvisors.destroy({ where: { deal_id: deal.id } });

        // finally delete deal itself
        await deal.destroy();
      }

      // delete master deal itself:
      await masterDeal.destroy();

      // return the success response:
      return helper.success(
        res,
        "Master deal and related deals deleted successfully",
        {
          id: requiredData.id,
        }
      );
    } catch (err) {
      return helper.error(res, err);
    }
  },

  // update master deal:

  getDealStats: async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id);
      const whereClause = {
        [Op.not]: {
          deal_status: "closed",
        },
      };

      // Apply role-based filters for non-admin users
      if (user.role !== "admin") {
        // fetch team member assigned deals:
        const teamMemberDeals = await DealTeamMembers.findAll({
          attributes: ["deal_id"],
          where: { user_id: user.id },
        });

        const teamDealIds = teamMemberDeals.map((entry) => entry.deal_id);

        // fetch external advisor assigned deals:
        const externalAdvisorDeals = await DealExternalAdvisors.findAll({
          attributes: ["deal_id"],
          where: { user_id: user.id },
        });
        const externalAdvisorDealIds = externalAdvisorDeals.map(
          (entry) => entry.deal_id
        );

        whereClause[Op.and] = [
          {
            [Op.or]: [
              { user_id: user.id },
              { deal_lead_id: user.id },
              { assistant_deal_lead_id: user.id },
              { id: { [Op.in]: teamDealIds } },
              { id: { [Op.in]: externalAdvisorDealIds } },
            ],
          },
        ];
      }

      // Get total active deals
      const totalActiveDeals = await Deal.count({
        where: whereClause,
      });

      // Get total pipeline value (sum of purchase prices)
      const pipelineValue = await Deal.sum("purchase_price", {
        where: { ...whereClause, deal_status: "pipeline" },
      });

      // Get average deal size
      const avgDealSize = await Deal.findOne({
        attributes: [
          [sequelize.fn("AVG", sequelize.col("purchase_price")), "average"],
        ],
        where: whereClause,
      });

      // Get closing this month count
      const currentDate = new Date();
      const firstDayOfMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1
      );
      const lastDayOfMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0
      );

      const closingThisMonth = await Deal.count({
        where: {
          ...whereClause,
          target_close_date: {
            [Op.between]: [firstDayOfMonth, lastDayOfMonth],
          },
        },
      });

      // Calculate success rate
      const totalDeals = await Deal.count({
        where:
          user.role === "admin"
            ? {}
            : {
                [Op.or]: [
                  { user_id: user.id },
                  { deal_lead_id: user.id },
                  { assistant_deal_lead_id: user.id },
                ],
              },
      });

      const successRate =
        totalDeals > 0 ? ((totalActiveDeals / totalDeals) * 100).toFixed(0) : 0;

      const stats = {
        total_active_deals: totalActiveDeals,
        total_pipeline_value:
          pipelineValue && pipelineValue > 1000000
            ? `$${(pipelineValue / 1000000).toFixed(1)}M`
            : pipelineValue,
        average_deal_size:
          avgDealSize?.dataValues?.average &&
          avgDealSize?.dataValues?.average > 1000000
            ? `$${(avgDealSize.dataValues.average / 1000000).toFixed(1)}M`
            : avgDealSize?.dataValues?.average,
        closing_this_month: closingThisMonth,
        success_rate: `${successRate}%`,
      };

      return helper.success(res, "Deal statistics fetched successfully", stats);
    } catch (err) {
      return helper.error(res, err);
    }
  },

  // Dashboard Api:
  getDashboardData: async (req, res) => {
    try {
      const userId = req.user.id;
      const user = await User.findByPk(userId);
      const isAdmin = user.role === "admin";

      let userDealIds = [];
      if (!isAdmin) {
        const userDeals = await Deal.findAll({
          attributes: ["id"],
          where: { user_id: userId },
        });
        const leadDeals = await Deal.findAll({
          attributes: ["id"],
          where: { deal_lead_id: userId },
        });
        const assistantDeals = await Deal.findAll({
          attributes: ["id"],
          where: { assistant_deal_lead_id: userId },
        });
        const teamDeals = await DealTeamMembers.findAll({
          attributes: ["deal_id"],
          where: { user_id: userId },
        });
        const advisorDeals = await DealExternalAdvisors.findAll({
          attributes: ["deal_id"],
          where: { user_id: userId },
        });
        userDealIds = [
          ...userDeals.map((d) => d.id),
          ...leadDeals.map((d) => d.id),
          ...assistantDeals.map((d) => d.id),
          ...teamDeals.map((d) => d.deal_id),
          ...advisorDeals.map((d) => d.deal_id),
        ];
        userDealIds = [...new Set(userDealIds)];
      }

      const whereClause = isAdmin ? {} : { id: { [Op.in]: userDealIds } };

      const currentDate = new Date();

      const startOfWeek = new Date();
      startOfWeek.setUTCDate(
        currentDate.getUTCDate() - currentDate.getUTCDay()
      );
      startOfWeek.setUTCHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
      endOfWeek.setUTCHours(23, 59, 59, 999);

      const firstDayOfMonth = new Date(
        Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 1)
      );
      const lastDayOfMonth = new Date(
        Date.UTC(
          currentDate.getUTCFullYear(),
          currentDate.getUTCMonth() + 1,
          0,
          23,
          59,
          59,
          999
        )
      );

      const thisQuarterRange = helper.getQuarterDateRangeUTC(0);
      const lastQuarterRange = helper.getQuarterDateRangeUTC(-1);

      // Run aggregate queries in parallel
      const [
        openDeals,
        weeklyDeals,
        totalPipelineRevenue,
        monthlyRevenue,
        dueDiligenceDeals,
        avgCloseAllDeals,
        thisQuarterAvg,
        lastQuarterAvg,
        allDealsGrouped,
        totalBeds,
        totalRevenue,
        avgOccupancy,
      ] = await Promise.all([
        Deal.count({
          where: { ...whereClause, deal_status: { [Op.not]: "closed" } },
        }),

        Deal.count({
          where: {
            ...whereClause,
            deal_status: { [Op.not]: "closed" },
            created_at: { [Op.between]: [startOfWeek, endOfWeek] },
          },
        }),

        Deal.sum("purchase_price", {
          where: { ...whereClause, deal_status: "pipeline" },
        }),

        Deal.sum("annual_revenue", {
          where: {
            ...whereClause,
            deal_status: "pipeline",
            created_at: { [Op.between]: [firstDayOfMonth, lastDayOfMonth] },
          },
        }),

        Deal.count({ where: { ...whereClause, deal_status: "due_diligence" } }),

        Deal.findOne({
          attributes: [
            [
              sequelize.fn(
                "AVG",
                getDateDiffLiteral("target_close_date", "created_at")
              ),
              "average_days",
            ],
          ],
          where: { ...whereClause, deal_status: "closed" },
          raw: true,
        }),

        Deal.findOne({
          attributes: [
            [
              sequelize.fn(
                "AVG",
                getDateDiffLiteral("target_close_date", "created_at")
              ),
              "average_days",
            ],
          ],
          where: {
            ...whereClause,
            deal_status: "closed",
            created_at: {
              [Op.between]: [
                thisQuarterRange.startDate,
                thisQuarterRange.endDate,
              ],
            },
          },
          raw: true,
        }),

        Deal.findOne({
          attributes: [
            [
              sequelize.fn(
                "AVG",
                getDateDiffLiteral("target_close_date", "created_at")
              ),
              "average_days",
            ],
          ],
          where: {
            ...whereClause,
            deal_status: "closed",
            created_at: {
              [Op.between]: [
                lastQuarterRange.startDate,
                lastQuarterRange.endDate,
              ],
            },
          },
          raw: true,
        }),

        Deal.findAll({
          attributes: ["id", "deal_name", "deal_status"],
          where: {
            ...whereClause,
            deal_status: {
              [Op.in]: ["closed", "due_diligence", "pipeline", "final_review"],
            },
          },
          order: [["created_at", "DESC"]],
          raw: true,
        }),

        Deal.sum("no_of_beds", { where: { ...whereClause } }),
        Deal.sum("annual_revenue", { where: { ...whereClause } }),

        Deal.findOne({
          attributes: [
            [
              sequelize.fn("AVG", sequelize.col("current_occupancy")),
              "average_occupancy",
            ],
          ],
          where: { ...whereClause },
          raw: true,
        }),
      ]);

      const thisAvg = thisQuarterAvg?.average_days
        ? parseFloat(thisQuarterAvg.average_days)
        : 0;
      const lastAvg = lastQuarterAvg?.average_days
        ? parseFloat(lastQuarterAvg.average_days)
        : 0;
      const difference = lastAvg - thisAvg;

      const groupedDeals = {
        closedDeals: allDealsGrouped
          .filter((d) => d.deal_status === "closed")
          .slice(0, 5),
        dueDiligenceDeals: allDealsGrouped
          .filter((d) => d.deal_status === "due_diligence")
          .slice(0, 5),
        pipelineDeals: allDealsGrouped
          .filter((d) => d.deal_status === "pipeline")
          .slice(0, 5),
        finalReviewDeals: allDealsGrouped
          .filter((d) => d.deal_status === "final_review")
          .slice(0, 5),
      };

      const averageRevenuePerBed = totalBeds > 0 ? totalRevenue / totalBeds : 0;

      const responseData = {
        total_deals: openDeals,
        weekly_deals: weeklyDeals,
        total_revenue:
          totalRevenue && totalRevenue > 1000000
            ? `$${(totalRevenue / 1000000).toFixed(1)}M`
            : totalRevenue,
        monthly_revenue: monthlyRevenue,
        due_diligence_deals: dueDiligenceDeals,
        average_deal_close_date: avgCloseAllDeals?.average_days ?? 0,
        average_deal_close_date_difference: difference,
        total_pipeline_revenue:
          totalPipelineRevenue && totalPipelineRevenue > 1000000
            ? `$${(totalPipelineRevenue / 1000000).toFixed(1)}M`
            : totalPipelineRevenue,
        total_beds: totalBeds,
        average_revenue_per_bed: averageRevenuePerBed,
        average_current_occupancy: avgOccupancy?.average_occupancy ?? 0,
        ...groupedDeals,
      };

      return helper.success(
        res,
        "Deal statistics fetched successfully",
        responseData
      );
    } catch (error) {
      console.error(error);
      return helper.error(res, error);
    }
  },

  getDealById: async (req, res) => {
    try {
      const required = {
        id: req.query.id,
      };
      const nonrequired = {};
      const requiredData = await helper.validateObject(required, nonrequired);
      const deal = await Deal.findByPk(requiredData.id, {
        include: [
          {
            model: User,
            as: "deal_lead",
            attributes: [
              "id",
              "first_name",
              "last_name",
              "email",
              "phone_number",
            ],
          },
          {
            model: User,
            as: "assistant_deal_lead",
            attributes: [
              "id",
              "first_name",
              "last_name",
              "email",
              "phone_number",
            ],
          },
          {
            model: DealTeamMembers,
            as: "deal_team_members",
            include: [
              {
                model: User,
                as: "user",
                attributes: ["id", "first_name", "last_name", "profile_url"],
              },
            ],
          },
          {
            model: DealExternalAdvisors,
            as: "deal_external_advisors",
            include: [
              {
                model: User,
                as: "user",
                attributes: ["id", "first_name", "last_name", "profile_url"],
              },
            ],
          },
          {
            model: DealFacilities,
            as: "facilities",
            order: [['display_order', 'ASC'], ['created_at', 'ASC']]
          },
        ],
      });
      return helper.success(res, "Deal fetched successfully", deal);
    } catch (err) {
      return helper.error(res, err);
    }
  },

  deleteDeal: async (req, res) => {
    try {
      const required = { id: req.params.id };
      const nonrequired = {};
      const requiredData = await helper.validateObject(required, nonrequired);

      // fetch the deal:
      const deal = await Deal.findByPk(requiredData.id);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // delete the deal comments:
      await DealComments.destroy({
        where: {
          deal_id: requiredData.id,
          parent_id: { [Op.ne]: null },
        },
      });
      await DealComments.destroy({
        where: {
          deal_id: requiredData.id,
          parent_id: null,
        },
      });

      // delete the deal documents:
      await DealDocuments.destroy({ where: { deal_id: requiredData.id } });

      // delete the deal team members:
      await DealTeamMembers.destroy({ where: { deal_id: requiredData.id } });

      // delete the deal external advisors:
      await DealExternalAdvisors.destroy({
        where: { deal_id: requiredData.id },
      });

      // delete the deal:
      await deal.destroy();

      // return the success response:
      return helper.success(res, "Deal deleted successfully", {
        id: requiredData.id,
      });
    } catch (err) {
      return helper.error(res, err);
    }
  },

  updateDeal: async (req, res) => {
    try {
      // Extract fields from request body
      const {
        id,
        deal_name,
        user_id,
        deal_type,
        facility_name,
        facility_type,
        no_of_beds,
        city,
        state,
        zip_code,
        purchase_price = 0,
        annual_revenue = 0,
        deal_lead_id,
        priority_level,
        deal_source,
        country,
        street_address,
        primary_contact_name,
        title,
        phone_number,
        email,
        target_close_date,
        dd_period_weeks,
        price_per_bed = 0,
        down_payment = 0,
        financing_amount = 0,
        revenue_multiple = 0,
        ebitda = 0,
        ebitda_multiple = 0,
        ebitda_margin = 0,
        net_operating_income = 0,
        current_occupancy = 0,
        average_daily_rate = 0,
        medicare_percentage = 0,
        private_pay_percentage = 0,
        target_irr_percentage = 0,
        target_hold_period = 0,
        projected_cap_rate_percentage = 0,
        exit_multiple = 0,
        assistant_deal_lead_id,
        deal_team_members,
        deal_external_advisors,
        deal_status,
        notificationSettings = {},
      } = req.body;

      // Compose required and nonrequired objects for validation
      const required = {
        id,
        deal_name,
        user_id,
        deal_type,
        facility_name,
        facility_type,
        no_of_beds,
        city,
        state,
        country,
        zip_code,
        street_address,
        purchase_price: purchase_price ? purchase_price : 0,
        annual_revenue: annual_revenue ? annual_revenue : 0,
        deal_lead_id,
      };
      const nonrequired = {
        priority_level,
        deal_source,
        primary_contact_name,
        title,
        phone_number,
        email,
        target_close_date,
        dd_period_weeks,
        price_per_bed: price_per_bed ? price_per_bed : 0,
        down_payment: down_payment ? down_payment : 0,
        financing_amount: financing_amount ? financing_amount : 0,
        revenue_multiple: revenue_multiple ? revenue_multiple : 0,
        ebitda: ebitda ? ebitda : 0,
        ebitda_multiple: ebitda_multiple ? ebitda_multiple : 0,
        ebitda_margin: ebitda_margin ? ebitda_margin : 0,
        net_operating_income: net_operating_income ? net_operating_income : 0,
        current_occupancy: current_occupancy ? current_occupancy : 0,
        average_daily_rate: average_daily_rate ? average_daily_rate : 0,
        medicare_percentage: medicare_percentage ? medicare_percentage : 0,
        private_pay_percentage: private_pay_percentage
          ? private_pay_percentage
          : 0,
        target_irr_percentage: target_irr_percentage
          ? target_irr_percentage
          : 0,
        target_hold_period: target_hold_period ? target_hold_period : 0,
        projected_cap_rate_percentage: projected_cap_rate_percentage
          ? projected_cap_rate_percentage
          : 0,
        exit_multiple: exit_multiple ? exit_multiple : 0,
        assistant_deal_lead_id,
        deal_team_members,
        deal_external_advisors,
        deal_status,
      };

      const requiredData = await helper.validateObject(required, nonrequired);

      // Convert notification settings to 'yes'/'no'
      requiredData.email_notification_major_updates =
        notificationSettings.email_notification_major_updates === true
          ? "yes"
          : "no";
      requiredData.weekly_progress_report =
        notificationSettings.weekly_progress_report === true ? "yes" : "no";
      requiredData.slack_integration_for_team_communication =
        notificationSettings.slack_integration_for_team_communication === true
          ? "yes"
          : "no";
      requiredData.calendar_integration =
        notificationSettings.calendar_integration === true ? "yes" : "no";
      requiredData.sms_alert_for_urgent_items =
        notificationSettings.sms_alert_for_urgent_items === true ? "yes" : "no";
      requiredData.document_upload_notification =
        notificationSettings.document_upload_notification === true
          ? "yes"
          : "no";

      // Find the deal to update
      const deal = await Deal.findByPk(requiredData.id);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      const userData = await User.findByPk(requiredData.user_id);

      // create user set:
      const allUserIds = new Set();
      allUserIds.add(deal.deal_lead_id);
      allUserIds.add(deal.assistant_deal_lead_id);
      allUserIds.add(deal.user_id);

      // Update the deal
      await deal.update(requiredData);

      // fetch all users who are mentioned in the comment:
      if (deal_team_members) {
        await DealTeamMembers.destroy({ where: { deal_id: requiredData.id } });
        deal_team_members.forEach(async (member) => {
          await DealTeamMembers.create({
            deal_id: requiredData.id,
            user_id: member.user_id ? member.user_id : member.id,
          });
          allUserIds.add(member.user_id);
        });
      }

      if (deal_external_advisors) {
        await DealExternalAdvisors.destroy({
          where: { deal_id: requiredData.id },
        });
        deal_external_advisors.forEach(async (advisor) => {
          await DealExternalAdvisors.create({
            deal_id: requiredData.id,
            user_id: advisor.user_id ? advisor.user_id : advisor.id,
          });
          allUserIds.add(advisor.user_id);
        });
      }

      // create recent activity:
      await Promise.all(
        Array.from(allUserIds).map(async (userId) => {
          if (userId !== userData.id) {
            await RecentActivity.create({
              to_id: userId,
              from_id: userData.id,
              action: "deal_updated",
              subject_type: "deal",
              subject_id: requiredData.id,
              is_team: true,
              message: `The deal <strong>${deal.deal_name}</strong> has been updated by <strong>${userData.first_name} ${userData.last_name}</strong> on our platform.`,
              data: JSON.stringify({
                deal_id: deal.id,
                deal_name: deal.deal_name,
                to_id: userId,
                from_id: userData.id,
              }),
            });
          }
        })
      );

      const updatedDeal = await Deal.findByPk(requiredData.id, {
        include: [
          {
            model: DealTeamMembers,
            as: "deal_team_members",
            include: [
              {
                model: User,
                as: "user",
                attributes: ["id", "first_name", "last_name", "profile_url"],
              },
            ],
          },
          {
            model: DealExternalAdvisors,
            as: "deal_external_advisors",
            include: [
              {
                model: User,
                as: "user",
                attributes: ["id", "first_name", "last_name", "profile_url"],
              },
            ],
          },
        ],
      });

      return helper.success(res, "Deal updated successfully", updatedDeal);
    } catch (err) {
      return helper.error(res, err);
    }
  },

  /* 
  This function will help to update the deal status:
  Method: PUT
  URL: /api/v1/deal/update-deal-status
  */
  updateDealStatus: async (req, res) => {
    try {
      const required = { id: req.body.id, deal_status: req.body.deal_status };
      const nonrequired = {};
      const requiredData = await helper.validateObject(required, nonrequired);

      // update the deal status:
      const deal = await Deal.findByPk(requiredData.id);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // update the deal status:
      await deal.update({ deal_status: requiredData.deal_status });

      // return the success response:
      return helper.success(res, "Deal status updated successfully", deal);
    } catch (err) {
      return helper.error(res, err);
    }
  },

  /*
  This function will help to add a deal comment:
  METHOD: POST
  */
  addDealComment: async (req, res) => {
    try {
      const required = {
        deal_id: req.body.deal_id,
        user_id: req.user.id,
        comment: req.body.comment,
      };

      const nonrequired = {
        mentioned_user_ids: req.body.mentioned_user_ids || [],
        parent_id: req.body.parent_id || null,
      };

      const validatedData = await helper.validateObject(required, nonrequired);

      // fetch user:
      const userDetails = await User.findByPk(validatedData.user_id);

      // Create the comment
      const dealComment = await DealComments.create({
        deal_id: validatedData.deal_id,
        user_id: validatedData.user_id,
        comment: validatedData.comment,
        parent_id: validatedData.parent_id,
      });

      const allUserIds = new Set();

      // fetch deal data
      const deal = await Deal.findByPk(validatedData.deal_id);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      allUserIds.add(deal.deal_lead_id);
      allUserIds.add(deal.assistant_deal_lead_id);

      // Save mentions and send notifications:
      if (
        Array.isArray(validatedData.mentioned_user_ids) &&
        validatedData.mentioned_user_ids.length > 0
      ) {
        const mentionData = validatedData.mentioned_user_ids.map((user_id) => ({
          comment_id: dealComment.id,
          mentioned_user_id: user_id,
        }));
        await CommentMentions.bulkCreate(mentionData);

        for (const user_id of validatedData.mentioned_user_ids) {
          if (user_id !== req.user.id) {
            await UserNotification.create({
              to_id: user_id,
              from_id: userDetails.id,
              notification_type: "comment",
              title: "You were mentioned in a comment",
              content: `${userDetails.first_name} ${userDetails.last_name} mentioned you in a comment on deal ${deal.deal_name}`,
              ref_id: dealComment.id,
            });
            allUserIds.add(user_id);
          }
        }
      }

      // fetch all users who are mentioned in the comment:
      const dealTeamMembers = await DealTeamMembers.findAll({
        where: {
          deal_id: validatedData.deal_id,
        },
      });
      dealTeamMembers.forEach((member) => {
        allUserIds.add(member.user_id);
      });

      const dealExternalAdvisors = await DealExternalAdvisors.findAll({
        where: {
          deal_id: validatedData.deal_id,
        },
      });
      dealExternalAdvisors.forEach((member) => {
        allUserIds.add(member.user_id);
      });

      // create recent activity:
      await Promise.all(
        Array.from(allUserIds).map(async (userId) => {
          if (userId !== userDetails.id) {
            await RecentActivity.create({
              to_id: userId,
              from_id: userDetails.id,
              action: "mentioned_in_comment",
              subject_type: "deal_comment",
              subject_id: dealComment.id,
              message: `<strong>${userDetails.first_name} ${userDetails.last_name}</strong> mentioned you in a comment on deal <strong>${deal.deal_name}</strong>.`,
              data: JSON.stringify({
                deal_id: deal.id,
                deal_name: deal.deal_name,
                comment_id: dealComment.id,
                to_id: userId,
                from_id: userDetails.id,
              }),
            });
          }
        })
      );

      // If it's a reply, send a notification to the original commenter
      if (validatedData.parent_id) {
        const parentComment = await DealComments.findByPk(
          validatedData.parent_id
        );
        if (parentComment && parentComment.user_id !== req.user.id) {
          await UserNotification.create({
            to_id: parentComment.user_id,
            from_id: userDetails.id,
            notification_type: "reply",
            title: "New reply on your comment",
            content: `${userDetails.first_name} ${userDetails.last_name} replied to your comment on deal #${validatedData.deal_id}`,
            ref_id: dealComment.id,
          });
        }
      }

      // Return with user details
      const dealCommentData = await DealComments.findByPk(dealComment.id, {
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "first_name", "last_name", "profile_url"],
          },
        ],
      });

      return helper.success(
        res,
        "Deal comment added successfully",
        dealCommentData
      );
    } catch (err) {
      return helper.error(res, err);
    }
  },

  /*
  This function will help to fetch all deal comments:
  Method: GET
  URL: /api/v1/deal/get-deal-comments
  */
  getDealComments: async (req, res) => {
    try {
      const required = { deal_id: req.query.deal_id };
      const nonrequired = {};
      const requiredData = await helper.validateObject(required, nonrequired);

      const dealComments = await DealComments.findAll({
        where: {
          deal_id: requiredData.deal_id,
          parent_id: null,
        },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "first_name", "last_name", "profile_url"],
          },
          {
            model: DealComments,
            as: "replies",
            include: [
              {
                model: User,
                as: "user",
                attributes: ["id", "first_name", "last_name", "profile_url"],
              },
              {
                model: User,
                as: "mentioned_users",
                attributes: ["id", "first_name", "last_name", "profile_url"],
              },
            ],
          },
          {
            model: User,
            as: "mentioned_users",
            attributes: ["id", "first_name", "last_name"],
          },
        ],
        order: [["created_at", "DESC"]],
      });

      return helper.success(
        res,
        "Deal comments fetched successfully",
        dealComments
      );
    } catch (err) {
      return helper.error(res, err);
    }
  },

  /* 
  This function will help to delete a deal comment:
  Method: DELETE
  URL: /api/v1/deal/delete-deal-comment
  */
  deleteDealComment: async (req, res) => {
    try {
      const required = { id: req.params.id };
      const nonrequired = {};
      const requiredData = await helper.validateObject(required, nonrequired);

      const dealComment = await DealComments.findByPk(requiredData.id);
      if (!dealComment) {
        return helper.error(res, "Deal comment not found");
      }

      // If it's a parent comment
      if (dealComment.parent_id === null) {
        // First delete all replies
        await DealComments.destroy({
          where: { parent_id: dealComment.id },
        });
      }

      // Delete the comment itself
      await dealComment.destroy();

      // return the success response:
      return helper.success(res, "Deal comment deleted successfully", {
        id: dealComment.id,
      });
    } catch (err) {
      return helper.error(res, err);
    }
  },

  addDealDocument: async (req, res) => {
    try {
      const required = {
        deal_id: req.body.deal_id,
        user_id: req.user.id,
        document_url: req.body.document_url,
        document_name: req.body.document_name,
      };
      const nonrequired = {};
      const requiredData = await helper.validateObject(required, nonrequired);

      // fetch deal:
      const deal = await Deal.findByPk(requiredData.deal_id);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // create user set:
      const allUserIds = new Set();
      allUserIds.add(deal.deal_lead_id);
      allUserIds.add(deal.assistant_deal_lead_id);
      allUserIds.add(deal.user_id);

      // fetch all users who are mentioned in the comment:
      const dealTeamMembers = await DealTeamMembers.findAll({
        where: {
          deal_id: requiredData.deal_id,
        },
      });
      dealTeamMembers.forEach((member) => {
        allUserIds.add(member.user_id);
      });

      const dealExternalAdvisors = await DealExternalAdvisors.findAll({
        where: {
          deal_id: requiredData.deal_id,
        },
      });
      dealExternalAdvisors.forEach((member) => {
        allUserIds.add(member.user_id);
      });

      // create deal document:
      const dealDocument = await DealDocuments.create(requiredData);

      // create recent activity:
      const userData = await User.findByPk(requiredData.user_id);
      await Promise.all(
        Array.from(allUserIds).map(async (userId) => {
          if (userId !== requiredData.user_id) {
            await RecentActivity.create({
              to_id: userId,
              from_id: requiredData.user_id,
              action: "new_deal_document_added",
              subject_type: "deal_document",
              subject_id: dealDocument.id,
              is_team: true,
              message: `A new document <strong>${dealDocument.document_name}</strong> has been added by <strong>${userData.first_name} ${userData.last_name}</strong> to the deal <strong>${deal.deal_name}</strong> on our platform.`,
              data: JSON.stringify({
                deal_id: deal.id,
                deal_name: deal.deal_name,
                document_id: dealDocument.id,
                to_id: userId,
                from_id: requiredData.user_id,
              }),
            });
          }
        })
      );

      // fetch deal document:
      const dealDocumentData = await DealDocuments.findByPk(dealDocument.id, {
        include: [{ model: User, as: "user" }],
      });
      return helper.success(
        res,
        "Deal document added successfully",
        dealDocumentData
      );
    } catch (err) {
      return helper.error(res, err);
    }
  },

  getDealDocuments: async (req, res) => {
    try {
      const required = {
        deal_id: req.query.deal_id,
      };
      const nonrequired = {};
      const requiredData = await helper.validateObject(required, nonrequired);
      const dealDocuments = await DealDocuments.findAll({
        where: { deal_id: requiredData.deal_id },
        include: [{ model: User, as: "user" }],
        order: [["created_at", "DESC"]],
      });
      return helper.success(
        res,
        "Deal documents fetched successfully",
        dealDocuments
      );
    } catch (err) {
      return helper.error(res, err);
    }
  },

  /* 
  This function will help to fetch all user notifications:
  Method: GET
  URL: /api/v1/deal/get-user-notifications
  */
  getUserNotifications: async (req, res) => {
    try {
      // fetch user notifications:
      const userNotifications = await UserNotification.findAll({
        where: { to_id: req.user.id },
        order: [["createdAt", "DESC"]],
      });
      if (userNotifications.length === 0) {
        return helper.success(res, "No user notifications found", []);
      }

      // return the success response:
      return helper.success(
        res,
        "User notifications fetched successfully",
        userNotifications
      );
    } catch (err) {
      return helper.error(res, err);
    }
  },

  /*
  This function will help to mark a user notification as read:
  Method: POST
  URL: /api/v1/deal/read-notification
  */
  markUserNotificationAsRead: async (req, res) => {
    try {
      // Mark all user notifications as read for this user
      await UserNotification.update(
        { is_read: true },
        {
          where: {
            status: 1,
            to_id: req.user.id,
          },
        }
      );

      return helper.success(res, "User notifications marked as read");
    } catch (err) {
      return helper.error(res, err);
    }
  },

  getActiveDeals: async (req, res) => {
    try {
      const search = req.query.search;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const user = await User.findByPk(req.user.id);

      const baseWhere = {
        deal_status: { [Op.not]: "closed" },
      };

      if (search) {
        baseWhere.deal_name = {
          [Op.like]: `%${search}%`,
        };
      }

      // For non-admin users, restrict results to associated deals
      if (user.role !== "admin") {
        // Fetch deal IDs from deal_team_members table
        const teamMemberDeals = await DealTeamMembers.findAll({
          attributes: ["deal_id"],
          where: { user_id: user.id },
        });

        const teamDealIds = teamMemberDeals.map((d) => d.deal_id);

        // fetch external advisor assigned deals:
        const externalAdvisorDeals = await DealExternalAdvisors.findAll({
          attributes: ["deal_id"],
          where: { user_id: user.id },
        });
        const externalAdvisorDealIds = externalAdvisorDeals.map(
          (entry) => entry.deal_id
        );

        baseWhere[Op.or] = [
          { user_id: user.id },
          { deal_lead_id: user.id },
          { assistant_deal_lead_id: user.id },
          { id: { [Op.in]: teamDealIds } },
          { id: { [Op.in]: externalAdvisorDealIds } },
        ];
      }

      const deal = await Deal.findAll({
        where: baseWhere,
        limit,
        offset,
        order: [["created_at", "DESC"]],
        include: [
          {
            model: User,
            as: "deal_lead",
            attributes: ["id", "first_name", "last_name", "profile_url"],
          },
          {
            model: User,
            as: "assistant_deal_lead",
            attributes: ["id", "first_name", "last_name", "profile_url"],
          },
        ],
      });

      const total = await Deal.count({ where: baseWhere });
      const totalPages = Math.ceil(total / limit);

      const body = {
        deals: deal,
        total,
        totalPages,
      };

      return helper.success(res, "Deals fetched successfully", body);
    } catch (err) {
      return helper.error(res, err);
    }
  },

  /**
   * Extract deal information from uploaded document(s) using AI
   * POST /api/v1/deal/extract-from-document
   */
  extractDealFromDocument: async (req, res) => {
    try {
      // Check if files were uploaded
      if (!req.files || !req.files.document) {
        return helper.error(res, "No document uploaded. Please upload a PDF, image, or text file.");
      }

      const uploadedFiles = req.files.document;

      // Handle single or multiple files
      const files = Array.isArray(uploadedFiles) ? uploadedFiles : [uploadedFiles];

      // Validate file types
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'text/plain',
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
      ];

      for (const file of files) {
        if (!allowedTypes.includes(file.mimetype) && !file.mimetype.startsWith('image/')) {
          return helper.error(res, `Unsupported file type: ${file.mimetype}. Please upload PDF, images, Excel, Word, or text files.`);
        }
      }

      // Check file size (max 20MB per file)
      const maxSize = 20 * 1024 * 1024; // 20MB
      for (const file of files) {
        if (file.size > maxSize) {
          return helper.error(res, `File ${file.name} exceeds maximum size of 20MB`);
        }
      }

      // Save files to local storage (temporarily without deal ID, will be moved after deal creation)
      const savedFiles = await saveFiles(files);
      const successfullySavedFiles = savedFiles.filter(f => f.success);

      let result;

      if (files.length === 1) {
        // Single file extraction
        result = await extractDealFromDocument(files[0].data, files[0].mimetype, files[0].name);

        if (!result.success) {
          return helper.error(res, result.error || "Failed to extract data from document");
        }

        return helper.success(res, "Deal data extracted successfully", {
          extractedData: result.data,
          confidence: result.confidence,
          fileName: files[0].name,
          uploadedFiles: successfullySavedFiles.map(f => ({
            filename: f.filename,
            originalName: f.originalName,
            url: f.url,
            mimeType: f.mimeType,
            size: f.size
          }))
        });
      } else {
        // Multiple files - merge results
        result = await extractFromMultipleDocuments(files);

        if (!result.success) {
          return helper.error(res, "Failed to extract data from documents");
        }

        return helper.success(res, "Deal data extracted from multiple documents", {
          extractedData: result.mergedData,
          confidence: result.confidence,
          individualResults: result.individualResults.map(r => ({
            fileName: r.fileName,
            success: r.success,
            confidence: r.confidence
          })),
          uploadedFiles: successfullySavedFiles.map(f => ({
            filename: f.filename,
            originalName: f.originalName,
            url: f.url,
            mimeType: f.mimeType,
            size: f.size
          }))
        });
      }
    } catch (err) {
      console.error("Document extraction error:", err);
      return helper.error(res, err.message || "Failed to process document");
    }
  },

  /**
   * Serve uploaded files
   * GET /api/v1/files/:path
   */
  serveFile: async (req, res) => {
    try {
      const filePath = req.params[0]; // Capture the full path
      const file = getFile(filePath);

      if (!file) {
        return res.status(404).json({ success: false, message: "File not found" });
      }

      // Determine content type
      const ext = filePath.split('.').pop().toLowerCase();
      const mimeTypes = {
        'pdf': 'application/pdf',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'txt': 'text/plain',
        'csv': 'text/csv',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };

      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${filePath.split('/').pop()}"`);
      res.send(file.buffer);
    } catch (err) {
      console.error("File serve error:", err);
      return res.status(500).json({ success: false, message: "Failed to serve file" });
    }
  },

  /**
   * Get all uploaded files for a deal
   * GET /api/v1/deal/get-uploaded-files/:dealId
   */
  getUploadedFiles: async (req, res) => {
    try {
      const dealId = req.params.dealId;
      const files = getDealFiles(dealId);
      return helper.success(res, "Files retrieved successfully", files);
    } catch (err) {
      return helper.error(res, err);
    }
  },

  /**
   * Calculate deal metrics for underwriting
   * GET /api/v1/deal/calculate/:dealId
   */
  calculateDealMetrics: async (req, res) => {
    try {
      const { dealId } = req.params;

      // Fetch the deal with all necessary data including facilities
      const deal = await Deal.findByPk(dealId, {
        include: [{
          model: DealFacilities,
          as: 'facilities',
          order: [['display_order', 'ASC']]
        }]
      });

      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // If deal has facilities, aggregate their data for calculation
      const dealData = deal.toJSON();
      if (dealData.facilities && dealData.facilities.length > 0) {
        // Aggregate facility data for multi-facility deals
        const aggregated = dealData.facilities.reduce((acc, facility) => {
          acc.total_beds += parseFloat(facility.total_beds) || 0;
          acc.total_revenue += parseFloat(facility.annual_revenue) || 0;
          acc.total_ebitda += parseFloat(facility.ebitda) || 0;
          acc.total_ebitdar += parseFloat(facility.ebitdar) || 0;
          acc.total_noi += parseFloat(facility.noi) || 0;
          acc.total_rent += parseFloat(facility.annual_rent) || 0;
          acc.total_purchase_price += parseFloat(facility.purchase_price) || 0;
          acc.facility_count += 1;
          return acc;
        }, {
          total_beds: 0,
          total_revenue: 0,
          total_ebitda: 0,
          total_ebitdar: 0,
          total_noi: 0,
          total_rent: 0,
          total_purchase_price: 0,
          facility_count: 0
        });

        // Override deal fields with aggregated values if not already set or if aggregated is higher
        if (aggregated.total_beds > 0) {
          dealData.no_of_beds = dealData.no_of_beds || aggregated.total_beds;
        }
        if (aggregated.total_revenue > 0) {
          dealData.annual_revenue = dealData.annual_revenue || aggregated.total_revenue;
        }
        if (aggregated.total_ebitda !== 0) {
          dealData.ebitda = dealData.ebitda || aggregated.total_ebitda;
        }
        if (aggregated.total_ebitdar !== 0) {
          dealData.ebitdar = dealData.ebitdar || aggregated.total_ebitdar;
        }
        if (aggregated.total_noi !== 0) {
          dealData.net_operating_income = dealData.net_operating_income || aggregated.total_noi;
        }
        if (aggregated.total_rent > 0) {
          dealData.annual_rent = dealData.annual_rent || aggregated.total_rent;
        }
        // Use aggregated purchase price if deal total_deal_amount is not set
        if (aggregated.total_purchase_price > 0 && !dealData.total_deal_amount) {
          dealData.total_deal_amount = aggregated.total_purchase_price;
        }

        // Add facility metrics to the response
        dealData.facility_metrics = {
          facility_count: aggregated.facility_count,
          aggregated_beds: aggregated.total_beds,
          aggregated_revenue: aggregated.total_revenue,
          aggregated_ebitda: aggregated.total_ebitda,
          aggregated_ebitdar: aggregated.total_ebitdar,
          aggregated_noi: aggregated.total_noi,
          aggregated_rent: aggregated.total_rent,
          aggregated_purchase_price: aggregated.total_purchase_price
        };
      }

      // Calculate enhanced metrics using the service (includes normalized values and benchmarks)
      const metrics = calcEnhancedMetrics(dealData);

      // Add facility info to response
      if (dealData.facility_metrics) {
        metrics.facilityMetrics = dealData.facility_metrics;
        metrics.hasFacilities = true;
      } else {
        metrics.hasFacilities = false;
      }

      return helper.success(res, "Deal metrics calculated successfully", metrics);
    } catch (err) {
      console.error("Calculator error:", err);
      return helper.error(res, err.message || "Failed to calculate deal metrics");
    }
  },

  /**
   * Calculate portfolio metrics for multiple deals under a master deal
   * GET /api/v1/deal/calculate-portfolio/:masterDealId
   */
  calculatePortfolioMetrics: async (req, res) => {
    try {
      const { masterDealId } = req.params;

      // Fetch all deals under this master deal
      const deals = await Deal.findAll({
        where: { master_deal_id: masterDealId }
      });

      if (!deals || deals.length === 0) {
        return helper.error(res, "No deals found for this portfolio");
      }

      // Calculate enhanced portfolio metrics using the service (includes normalized values)
      const metrics = calcEnhancedPortfolioMetrics(deals);

      return helper.success(res, "Portfolio metrics calculated successfully", metrics);
    } catch (err) {
      console.error("Portfolio calculator error:", err);
      return helper.error(res, err.message || "Failed to calculate portfolio metrics");
    }
  },

  // ============================================================================
  // FACILITY CRUD OPERATIONS
  // ============================================================================

  /**
   * Get all facilities for a deal
   * GET /api/v1/deal/:dealId/facilities
   */
  getDealFacilities: async (req, res) => {
    try {
      const { dealId } = req.params;

      // Verify deal exists
      const deal = await Deal.findByPk(dealId);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // Get all facilities for this deal
      const facilities = await DealFacilities.findAll({
        where: { deal_id: dealId },
        order: [['display_order', 'ASC'], ['created_at', 'ASC']]
      });

      return helper.success(res, "Facilities fetched successfully", facilities);
    } catch (err) {
      console.error("Get facilities error:", err);
      return helper.error(res, err.message || "Failed to fetch facilities");
    }
  },

  /**
   * Get a single facility by ID
   * GET /api/v1/deal/facility/:facilityId
   */
  getFacilityById: async (req, res) => {
    try {
      const { facilityId } = req.params;

      const facility = await DealFacilities.findByPk(facilityId, {
        include: [{
          model: Deal,
          as: 'deal',
          attributes: ['id', 'deal_name', 'deal_status']
        }]
      });

      if (!facility) {
        return helper.error(res, "Facility not found");
      }

      return helper.success(res, "Facility fetched successfully", facility);
    } catch (err) {
      console.error("Get facility error:", err);
      return helper.error(res, err.message || "Failed to fetch facility");
    }
  },

  /**
   * Create a new facility for a deal
   * POST /api/v1/deal/:dealId/facilities
   */
  createFacility: async (req, res) => {
    try {
      const { dealId } = req.params;
      const facilityData = req.body;

      // Verify deal exists
      const deal = await Deal.findByPk(dealId);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // Get the next display order
      const maxOrder = await DealFacilities.max('display_order', {
        where: { deal_id: dealId }
      });

      // Create the facility
      const facility = await DealFacilities.create({
        deal_id: dealId,
        facility_name: facilityData.facility_name,
        facility_type: facilityData.facility_type,
        street_address: facilityData.street_address,
        city: facilityData.city,
        state: facilityData.state,
        country: facilityData.country || 'USA',
        zip_code: facilityData.zip_code,
        latitude: facilityData.latitude,
        longitude: facilityData.longitude,
        no_of_beds: facilityData.no_of_beds,
        total_beds: facilityData.total_beds,
        purchase_price: facilityData.purchase_price,
        price_per_bed: facilityData.price_per_bed,
        annual_revenue: facilityData.annual_revenue,
        revenue_multiple: facilityData.revenue_multiple,
        ebitda: facilityData.ebitda,
        ebitda_multiple: facilityData.ebitda_multiple,
        ebitda_margin: facilityData.ebitda_margin,
        ebitdar: facilityData.ebitdar,
        ebitdar_margin: facilityData.ebitdar_margin,
        net_operating_income: facilityData.net_operating_income,
        current_occupancy: facilityData.current_occupancy,
        average_daily_rate: facilityData.average_daily_rate,
        average_daily_census: facilityData.average_daily_census,
        medicare_percentage: facilityData.medicare_percentage,
        medicaid_percentage: facilityData.medicaid_percentage,
        private_pay_percentage: facilityData.private_pay_percentage,
        other_payer_percentage: facilityData.other_payer_percentage,
        medicare_revenue: facilityData.medicare_revenue,
        medicaid_revenue: facilityData.medicaid_revenue,
        private_pay_revenue: facilityData.private_pay_revenue,
        other_revenue: facilityData.other_revenue,
        total_expenses: facilityData.total_expenses,
        operating_expenses: facilityData.operating_expenses,
        rent_lease_expense: facilityData.rent_lease_expense,
        property_taxes: facilityData.property_taxes,
        property_insurance: facilityData.property_insurance,
        depreciation: facilityData.depreciation,
        amortization: facilityData.amortization,
        interest_expense: facilityData.interest_expense,
        rate_information: facilityData.rate_information,
        pro_forma_projections: facilityData.pro_forma_projections,
        extraction_data: facilityData.extraction_data,
        notes: facilityData.notes,
        display_order: (maxOrder || 0) + 1,
        created_at: new Date(),
        updated_at: new Date()
      });

      return helper.success(res, "Facility created successfully", facility);
    } catch (err) {
      console.error("Create facility error:", err);
      return helper.error(res, err.message || "Failed to create facility");
    }
  },

  /**
   * Update a facility
   * PUT /api/v1/deal/facility/:facilityId
   */
  updateFacility: async (req, res) => {
    try {
      const { facilityId } = req.params;
      const facilityData = req.body;

      const facility = await DealFacilities.findByPk(facilityId);
      if (!facility) {
        return helper.error(res, "Facility not found");
      }

      // Update the facility
      await facility.update({
        facility_name: facilityData.facility_name ?? facility.facility_name,
        facility_type: facilityData.facility_type ?? facility.facility_type,
        street_address: facilityData.street_address ?? facility.street_address,
        city: facilityData.city ?? facility.city,
        state: facilityData.state ?? facility.state,
        country: facilityData.country ?? facility.country,
        zip_code: facilityData.zip_code ?? facility.zip_code,
        latitude: facilityData.latitude ?? facility.latitude,
        longitude: facilityData.longitude ?? facility.longitude,
        no_of_beds: facilityData.no_of_beds ?? facility.no_of_beds,
        total_beds: facilityData.total_beds ?? facility.total_beds,
        purchase_price: facilityData.purchase_price ?? facility.purchase_price,
        price_per_bed: facilityData.price_per_bed ?? facility.price_per_bed,
        annual_revenue: facilityData.annual_revenue ?? facility.annual_revenue,
        revenue_multiple: facilityData.revenue_multiple ?? facility.revenue_multiple,
        ebitda: facilityData.ebitda ?? facility.ebitda,
        ebitda_multiple: facilityData.ebitda_multiple ?? facility.ebitda_multiple,
        ebitda_margin: facilityData.ebitda_margin ?? facility.ebitda_margin,
        ebitdar: facilityData.ebitdar ?? facility.ebitdar,
        ebitdar_margin: facilityData.ebitdar_margin ?? facility.ebitdar_margin,
        net_operating_income: facilityData.net_operating_income ?? facility.net_operating_income,
        current_occupancy: facilityData.current_occupancy ?? facility.current_occupancy,
        average_daily_rate: facilityData.average_daily_rate ?? facility.average_daily_rate,
        average_daily_census: facilityData.average_daily_census ?? facility.average_daily_census,
        medicare_percentage: facilityData.medicare_percentage ?? facility.medicare_percentage,
        medicaid_percentage: facilityData.medicaid_percentage ?? facility.medicaid_percentage,
        private_pay_percentage: facilityData.private_pay_percentage ?? facility.private_pay_percentage,
        other_payer_percentage: facilityData.other_payer_percentage ?? facility.other_payer_percentage,
        medicare_revenue: facilityData.medicare_revenue ?? facility.medicare_revenue,
        medicaid_revenue: facilityData.medicaid_revenue ?? facility.medicaid_revenue,
        private_pay_revenue: facilityData.private_pay_revenue ?? facility.private_pay_revenue,
        other_revenue: facilityData.other_revenue ?? facility.other_revenue,
        total_expenses: facilityData.total_expenses ?? facility.total_expenses,
        operating_expenses: facilityData.operating_expenses ?? facility.operating_expenses,
        rent_lease_expense: facilityData.rent_lease_expense ?? facility.rent_lease_expense,
        property_taxes: facilityData.property_taxes ?? facility.property_taxes,
        property_insurance: facilityData.property_insurance ?? facility.property_insurance,
        depreciation: facilityData.depreciation ?? facility.depreciation,
        amortization: facilityData.amortization ?? facility.amortization,
        interest_expense: facilityData.interest_expense ?? facility.interest_expense,
        rate_information: facilityData.rate_information ?? facility.rate_information,
        pro_forma_projections: facilityData.pro_forma_projections ?? facility.pro_forma_projections,
        extraction_data: facilityData.extraction_data ?? facility.extraction_data,
        notes: facilityData.notes ?? facility.notes,
        display_order: facilityData.display_order ?? facility.display_order,
        updated_at: new Date()
      });

      return helper.success(res, "Facility updated successfully", facility);
    } catch (err) {
      console.error("Update facility error:", err);
      return helper.error(res, err.message || "Failed to update facility");
    }
  },

  /**
   * Delete a facility
   * DELETE /api/v1/deal/facility/:facilityId
   */
  deleteFacility: async (req, res) => {
    try {
      const { facilityId } = req.params;

      const facility = await DealFacilities.findByPk(facilityId);
      if (!facility) {
        return helper.error(res, "Facility not found");
      }

      await facility.destroy();

      return helper.success(res, "Facility deleted successfully");
    } catch (err) {
      console.error("Delete facility error:", err);
      return helper.error(res, err.message || "Failed to delete facility");
    }
  },

  /**
   * Bulk create facilities for a deal (useful for AI extraction)
   * POST /api/v1/deal/:dealId/facilities/bulk
   */
  createBulkFacilities: async (req, res) => {
    try {
      const { dealId } = req.params;
      const { facilities } = req.body;

      if (!Array.isArray(facilities) || facilities.length === 0) {
        return helper.error(res, "No facilities provided");
      }

      // Verify deal exists
      const deal = await Deal.findByPk(dealId);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // Get the current max display order
      const maxOrder = await DealFacilities.max('display_order', {
        where: { deal_id: dealId }
      }) || 0;

      // Create facilities with sequential display order
      const createdFacilities = await Promise.all(
        facilities.map((facilityData, index) =>
          DealFacilities.create({
            deal_id: dealId,
            ...facilityData,
            display_order: maxOrder + index + 1,
            created_at: new Date(),
            updated_at: new Date()
          })
        )
      );

      return helper.success(res, `${createdFacilities.length} facilities created successfully`, createdFacilities);
    } catch (err) {
      console.error("Bulk create facilities error:", err);
      return helper.error(res, err.message || "Failed to create facilities");
    }
  },

  /**
   * Update facility display order (for drag-and-drop reordering)
   * PUT /api/v1/deal/:dealId/facilities/reorder
   */
  reorderFacilities: async (req, res) => {
    try {
      const { dealId } = req.params;
      const { facilityIds } = req.body; // Array of facility IDs in new order

      if (!Array.isArray(facilityIds)) {
        return helper.error(res, "facilityIds must be an array");
      }

      // Update display_order for each facility
      await Promise.all(
        facilityIds.map((facilityId, index) =>
          DealFacilities.update(
            { display_order: index + 1, updated_at: new Date() },
            { where: { id: facilityId, deal_id: dealId } }
          )
        )
      );

      return helper.success(res, "Facilities reordered successfully");
    } catch (err) {
      console.error("Reorder facilities error:", err);
      return helper.error(res, err.message || "Failed to reorder facilities");
    }
  },

  // ============================================================================
  // BENCHMARK CONFIGURATION ENDPOINTS
  // ============================================================================

  /**
   * Get all benchmark configurations for current user
   * GET /api/v1/deal/benchmarks
   */
  getBenchmarkConfigs: async (req, res) => {
    try {
      const userId = req.user.id;

      const configs = await BenchmarkConfigurations.findAll({
        where: { user_id: userId },
        order: [['is_default', 'DESC'], ['created_at', 'DESC']]
      });

      // If no configs, return default benchmarks as a suggestion
      if (configs.length === 0) {
        return helper.success(res, "No saved configurations", {
          configs: [],
          default_benchmarks: DEFAULT_BENCHMARKS
        });
      }

      return helper.success(res, "Benchmark configurations retrieved", { configs });
    } catch (err) {
      console.error("Get benchmark configs error:", err);
      return helper.error(res, err.message || "Failed to get benchmark configurations");
    }
  },

  /**
   * Create a new benchmark configuration
   * POST /api/v1/deal/benchmarks
   */
  createBenchmarkConfig: async (req, res) => {
    try {
      const userId = req.user.id;
      const { config_name, is_default, ...benchmarkValues } = req.body;

      // If setting as default, unset other defaults
      if (is_default) {
        await BenchmarkConfigurations.update(
          { is_default: false },
          { where: { user_id: userId } }
        );
      }

      const config = await BenchmarkConfigurations.create({
        user_id: userId,
        config_name: config_name || 'Custom',
        is_default: is_default || false,
        ...benchmarkValues,
        created_at: new Date()
      });

      return helper.success(res, "Benchmark configuration created", config);
    } catch (err) {
      console.error("Create benchmark config error:", err);
      return helper.error(res, err.message || "Failed to create benchmark configuration");
    }
  },

  /**
   * Update a benchmark configuration
   * PUT /api/v1/deal/benchmarks/:id
   */
  updateBenchmarkConfig: async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { config_name, is_default, ...benchmarkValues } = req.body;

      const config = await BenchmarkConfigurations.findOne({
        where: { id, user_id: userId }
      });

      if (!config) {
        return helper.error(res, "Benchmark configuration not found");
      }

      // If setting as default, unset other defaults
      if (is_default) {
        await BenchmarkConfigurations.update(
          { is_default: false },
          { where: { user_id: userId, id: { [Op.ne]: id } } }
        );
      }

      await config.update({
        config_name: config_name !== undefined ? config_name : config.config_name,
        is_default: is_default !== undefined ? is_default : config.is_default,
        ...benchmarkValues,
        updated_at: new Date()
      });

      return helper.success(res, "Benchmark configuration updated", config);
    } catch (err) {
      console.error("Update benchmark config error:", err);
      return helper.error(res, err.message || "Failed to update benchmark configuration");
    }
  },

  /**
   * Delete a benchmark configuration
   * DELETE /api/v1/deal/benchmarks/:id
   */
  deleteBenchmarkConfig: async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const config = await BenchmarkConfigurations.findOne({
        where: { id, user_id: userId }
      });

      if (!config) {
        return helper.error(res, "Benchmark configuration not found");
      }

      await config.destroy();

      return helper.success(res, "Benchmark configuration deleted");
    } catch (err) {
      console.error("Delete benchmark config error:", err);
      return helper.error(res, err.message || "Failed to delete benchmark configuration");
    }
  },

  /**
   * Set a benchmark configuration as default
   * POST /api/v1/deal/benchmarks/:id/set-default
   */
  setDefaultBenchmarkConfig: async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const config = await BenchmarkConfigurations.findOne({
        where: { id, user_id: userId }
      });

      if (!config) {
        return helper.error(res, "Benchmark configuration not found");
      }

      // Unset all other defaults
      await BenchmarkConfigurations.update(
        { is_default: false },
        { where: { user_id: userId } }
      );

      // Set this one as default
      await config.update({ is_default: true, updated_at: new Date() });

      return helper.success(res, "Default benchmark configuration set", config);
    } catch (err) {
      console.error("Set default benchmark config error:", err);
      return helper.error(res, err.message || "Failed to set default benchmark configuration");
    }
  },

  // ============================================================================
  // PRO FORMA SCENARIO ENDPOINTS
  // ============================================================================

  /**
   * Get all pro forma scenarios for a deal
   * GET /api/v1/deal/:dealId/proforma
   */
  getProformaScenarios: async (req, res) => {
    try {
      const { dealId } = req.params;

      const scenarios = await DealProformaScenarios.findAll({
        where: { deal_id: dealId },
        order: [['created_at', 'DESC']]
      });

      return helper.success(res, "Pro forma scenarios retrieved", { scenarios });
    } catch (err) {
      console.error("Get proforma scenarios error:", err);
      return helper.error(res, err.message || "Failed to get pro forma scenarios");
    }
  },

  /**
   * Get a specific pro forma scenario with full details
   * GET /api/v1/deal/:dealId/proforma/:scenarioId
   */
  getProformaScenarioById: async (req, res) => {
    try {
      const { dealId, scenarioId } = req.params;

      const scenario = await DealProformaScenarios.findOne({
        where: { id: scenarioId, deal_id: dealId }
      });

      if (!scenario) {
        return helper.error(res, "Pro forma scenario not found");
      }

      // Get deal data for recalculation if needed
      const deal = await Deal.findByPk(dealId);

      return helper.success(res, "Pro forma scenario retrieved", {
        scenario,
        deal_name: deal?.deal_name,
        facility_name: deal?.facility_name
      });
    } catch (err) {
      console.error("Get proforma scenario error:", err);
      return helper.error(res, err.message || "Failed to get pro forma scenario");
    }
  },

  /**
   * Create a new pro forma scenario
   * POST /api/v1/deal/:dealId/proforma
   */
  createProformaScenario: async (req, res) => {
    try {
      const userId = req.user.id;
      const { dealId } = req.params;
      const { scenario_name, benchmark_overrides, notes } = req.body;

      // Get the deal
      const deal = await Deal.findByPk(dealId);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // Get user's default benchmark config
      const defaultConfig = await BenchmarkConfigurations.findOne({
        where: { user_id: userId, is_default: true }
      });

      // Normalize benchmarks and apply overrides
      const benchmarks = normalizeBenchmarkConfig(defaultConfig);
      const finalBenchmarks = { ...benchmarks, ...(benchmark_overrides || {}) };

      // Calculate pro forma
      const proformaResult = calculateProforma(deal.toJSON(), finalBenchmarks);
      const yearlyProjections = generateYearlyProjections(proformaResult);

      // Create scenario
      const scenario = await DealProformaScenarios.create({
        deal_id: dealId,
        user_id: userId,
        scenario_name: scenario_name || 'Base Case',
        benchmark_overrides: benchmark_overrides || {},
        stabilized_revenue: proformaResult.stabilized.revenue,
        stabilized_ebitda: proformaResult.stabilized.ebitda,
        stabilized_ebitdar: proformaResult.stabilized.ebitdar,
        stabilized_noi: proformaResult.stabilized.ebitda, // Using EBITDA as proxy
        total_opportunity: proformaResult.total_opportunity,
        total_opportunity_pct: proformaResult.total_opportunity_pct,
        stabilized_occupancy: proformaResult.stabilized.occupancy,
        stabilized_labor_pct: finalBenchmarks.labor_pct_target,
        opportunities: proformaResult.opportunities,
        yearly_projections: yearlyProjections,
        notes: notes || null,
        created_at: new Date()
      });

      return helper.success(res, "Pro forma scenario created", {
        scenario,
        calculation: proformaResult
      });
    } catch (err) {
      console.error("Create proforma scenario error:", err);
      return helper.error(res, err.message || "Failed to create pro forma scenario");
    }
  },

  /**
   * Update a pro forma scenario
   * PUT /api/v1/deal/:dealId/proforma/:scenarioId
   */
  updateProformaScenario: async (req, res) => {
    try {
      const userId = req.user.id;
      const { dealId, scenarioId } = req.params;
      const { scenario_name, benchmark_overrides, notes } = req.body;

      const scenario = await DealProformaScenarios.findOne({
        where: { id: scenarioId, deal_id: dealId }
      });

      if (!scenario) {
        return helper.error(res, "Pro forma scenario not found");
      }

      // Get the deal for recalculation
      const deal = await Deal.findByPk(dealId);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // Get user's default benchmark config
      const defaultConfig = await BenchmarkConfigurations.findOne({
        where: { user_id: userId, is_default: true }
      });

      // Normalize benchmarks and apply new overrides
      const benchmarks = normalizeBenchmarkConfig(defaultConfig);
      const newOverrides = benchmark_overrides !== undefined ? benchmark_overrides : scenario.benchmark_overrides;
      const finalBenchmarks = { ...benchmarks, ...newOverrides };

      // Recalculate pro forma
      const proformaResult = calculateProforma(deal.toJSON(), finalBenchmarks);
      const yearlyProjections = generateYearlyProjections(proformaResult);

      // Update scenario
      await scenario.update({
        scenario_name: scenario_name !== undefined ? scenario_name : scenario.scenario_name,
        benchmark_overrides: newOverrides,
        stabilized_revenue: proformaResult.stabilized.revenue,
        stabilized_ebitda: proformaResult.stabilized.ebitda,
        stabilized_ebitdar: proformaResult.stabilized.ebitdar,
        stabilized_noi: proformaResult.stabilized.ebitda,
        total_opportunity: proformaResult.total_opportunity,
        total_opportunity_pct: proformaResult.total_opportunity_pct,
        stabilized_occupancy: proformaResult.stabilized.occupancy,
        stabilized_labor_pct: finalBenchmarks.labor_pct_target,
        opportunities: proformaResult.opportunities,
        yearly_projections: yearlyProjections,
        notes: notes !== undefined ? notes : scenario.notes,
        updated_at: new Date()
      });

      return helper.success(res, "Pro forma scenario updated", {
        scenario,
        calculation: proformaResult
      });
    } catch (err) {
      console.error("Update proforma scenario error:", err);
      return helper.error(res, err.message || "Failed to update pro forma scenario");
    }
  },

  /**
   * Delete a pro forma scenario
   * DELETE /api/v1/deal/:dealId/proforma/:scenarioId
   */
  deleteProformaScenario: async (req, res) => {
    try {
      const { dealId, scenarioId } = req.params;

      const scenario = await DealProformaScenarios.findOne({
        where: { id: scenarioId, deal_id: dealId }
      });

      if (!scenario) {
        return helper.error(res, "Pro forma scenario not found");
      }

      await scenario.destroy();

      return helper.success(res, "Pro forma scenario deleted");
    } catch (err) {
      console.error("Delete proforma scenario error:", err);
      return helper.error(res, err.message || "Failed to delete pro forma scenario");
    }
  },

  /**
   * Calculate pro forma metrics WITHOUT saving (preview mode)
   * POST /api/v1/deal/:dealId/proforma/calculate
   */
  calculateProformaPreview: async (req, res) => {
    try {
      const userId = req.user.id;
      const { dealId } = req.params;
      const { benchmark_overrides } = req.body;

      // Get the deal
      const deal = await Deal.findByPk(dealId);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // Get user's default benchmark config
      const defaultConfig = await BenchmarkConfigurations.findOne({
        where: { user_id: userId, is_default: true }
      });

      // Normalize benchmarks and apply overrides
      const benchmarks = normalizeBenchmarkConfig(defaultConfig);
      const finalBenchmarks = { ...benchmarks, ...(benchmark_overrides || {}) };

      // Calculate pro forma
      const proformaResult = calculateProforma(deal.toJSON(), finalBenchmarks);
      const yearlyProjections = generateYearlyProjections(proformaResult);

      return helper.success(res, "Pro forma calculated", {
        ...proformaResult,
        yearly_projections: yearlyProjections,
        deal_name: deal.deal_name,
        facility_name: deal.facility_name
      });
    } catch (err) {
      console.error("Calculate proforma preview error:", err);
      return helper.error(res, err.message || "Failed to calculate pro forma");
    }
  },
};
