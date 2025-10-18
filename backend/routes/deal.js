import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

import { createDeal, acceptDeal, getAllDeals } from "../controllers/dealsController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import Deal from "../models/Deal.js";
import { uploadInvoice } from "../utils/uploadConfig.js";
import cloudinary from "../utils/cloudinaryConfig.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localInvoicesDir = path.join(__dirname, "../uploads/invoices");

const ensureLocalInvoicesDir = () => {
  if (!fs.existsSync(localInvoicesDir)) {
    fs.mkdirSync(localInvoicesDir, { recursive: true });
  }
};

const saveInvoiceLocally = (dealId, file) => {
  ensureLocalInvoicesDir();

  const extension = path.extname(file.originalname || "").toLowerCase();
  const safeExtension = extension === ".pdf" ? ".pdf" : ".pdf";
  const filename = `invoice-${dealId}-${Date.now()}${safeExtension}`;
  const fullPath = path.join(localInvoicesDir, filename);

  const dataBuffer = file.buffer || (file.path ? fs.readFileSync(file.path) : null);

  if (!dataBuffer) {
    throw new Error("Unable to persist invoice locally: no file buffer available");
  }

  fs.writeFileSync(fullPath, dataBuffer);

  file.filename = filename;
  file.path = fullPath;

  return { filename, fullPath };
};

// Buyer creates a new deal
router.post("/", verifyToken, createDeal);
router.post("/:id/accept", verifyToken, acceptDeal); 

// Get all deals (for testing/monitoring)
router.get("/", verifyToken, getAllDeals);

// Mark order as received (buyer only)
router.post("/:id/mark-received", verifyToken, async (req, res) => {
  try {
    const dealId = req.params.id;
    const buyerId = req.user.id; // Changed from req.user.userId to req.user.id

    console.log(`🔍 Mark as received request - DealID: ${dealId}, BuyerID: ${buyerId}`);

    // Find the deal
    const deal = await Deal.findById(dealId);
    
    if (!deal) {
      console.log("❌ Deal not found");
      return res.status(404).json({ error: "Deal not found" });
    }

    console.log(`📦 Deal found - BuyerID in deal: ${deal.buyerId}, Requesting user: ${buyerId}`);

    // Verify the user is the buyer
    if (deal.buyerId.toString() !== buyerId.toString()) {
      console.log("❌ User is not the buyer of this deal");
      return res.status(403).json({ error: "Only the buyer can mark the order as received" });
    }

    // Check if deal is in disbursed status
    if (deal.status !== 'disbursed') {
      console.log(`❌ Deal status is ${deal.status}, not disbursed`);
      return res.status(400).json({ 
        error: "Order can only be marked as received after payment has been disbursed",
        currentStatus: deal.status 
      });
    }

    // Update status to completed
    deal.status = 'completed';
    deal.completedAt = new Date();
    await deal.save();

    console.log(`✅ Deal ${dealId} marked as completed by buyer`);

    // Emit Socket.io event to notify cardholder
    const io = req.app.get('io');
    if (io) {
      io.emit('dealCompleted', {
        dealId: deal._id,
        message: '✅ Buyer has received the order! Deal completed.',
        completedAt: deal.completedAt
      });
    }

    res.json({ 
      success: true, 
      message: "Order marked as received successfully",
      deal: {
        _id: deal._id,
        status: deal.status,
        completedAt: deal.completedAt
      }
    });

  } catch (error) {
    console.error("❌ Error marking order as received:", error);
    res.status(500).json({ error: "Failed to mark order as received" });
  }
});

// Upload invoice PDF (cardholder only)
router.post("/:id/upload-invoice", verifyToken, uploadInvoice.single('invoice'), async (req, res) => {
  try {
    const dealId = req.params.id;
    const cardholderId = req.user.id;

    console.log(`📁 Invoice upload request - DealID: ${dealId}, CardholderID: ${cardholderId}`);

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Find the deal
    const deal = await Deal.findById(dealId);
    
    if (!deal) {
      console.log("❌ Deal not found");
      return res.status(404).json({ error: "Deal not found" });
    }

    // Verify the user is the cardholder
    if (!deal.cardholderId || deal.cardholderId.toString() !== cardholderId.toString()) {
      console.log("❌ User is not the cardholder of this deal");
      return res.status(403).json({ error: "Only the cardholder can upload invoice" });
    }

    let invoiceUrl;
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
    const buildLocalInvoiceUrl = (name) => `${baseUrl}/uploads/invoices/${name}`;

    // Check if Cloudinary is configured
    const useCloudinary = process.env.CLOUDINARY_CLOUD_NAME && 
                          process.env.CLOUDINARY_API_KEY && 
                          process.env.CLOUDINARY_API_SECRET;

    if (useCloudinary) {
      try {
        // Upload to Cloudinary
        console.log('☁️ Uploading to Cloudinary...');
        
        // Convert buffer to base64
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;
        
        const result = await cloudinary.uploader.upload(dataURI, {
          resource_type: 'raw',
          folder: 'splitpay/invoices',
          public_id: `invoice-${dealId}-${Date.now()}`,
          format: 'pdf'
        });
        
        invoiceUrl = result.secure_url;
        console.log(`✅ Uploaded to Cloudinary: ${invoiceUrl}`);

        try {
          const headResponse = await axios.head(invoiceUrl);
          if (headResponse.status < 200 || headResponse.status >= 300) {
            throw new Error(`Cloudinary accessibility check failed with status ${headResponse.status}`);
          }
        } catch (validationError) {
          console.warn(`⚠️ Cloudinary URL not accessible: ${validationError.message}. Falling back to local storage.`);
          const { filename, fullPath } = saveInvoiceLocally(dealId, req.file);
          invoiceUrl = buildLocalInvoiceUrl(filename);
          console.log(`✅ Saved locally after Cloudinary fallback: ${invoiceUrl}`);
          console.log(`📁 Local path: ${fullPath}`);
        }
      } catch (cloudError) {
        console.error("❌ Cloudinary upload failed:", cloudError.message || cloudError);
        const { filename, fullPath } = saveInvoiceLocally(dealId, req.file);
        invoiceUrl = buildLocalInvoiceUrl(filename);
        console.log(`✅ Saved locally due to Cloudinary failure: ${invoiceUrl}`);
        console.log(`📁 Local path: ${fullPath}`);
      }
    } else {
      // Use local storage - generate full URL
      invoiceUrl = buildLocalInvoiceUrl(req.file.filename);
      console.log(`✅ Saved locally: ${invoiceUrl}`);
      if (req.file.path) {
        console.log(`📁 File saved at: ${req.file.path}`);
      }
      if (typeof req.file.size === 'number') {
        console.log(`📊 File size: ${req.file.size} bytes`);
      }
    }

    // Save the invoice URL to deal
    deal.invoiceUrl = invoiceUrl;
    await deal.save();

    console.log(`✅ Invoice uploaded successfully: ${invoiceUrl}`);

    // Emit Socket.io event to notify buyer
    const io = req.app.get('io');
    if (io) {
      io.emit('invoiceUploaded', {
        dealId: deal._id,
        invoiceUrl: invoiceUrl,
        message: '📄 Invoice has been uploaded'
      });
    }

    res.json({ 
      success: true, 
      message: "Invoice uploaded successfully",
      invoiceUrl: invoiceUrl
    });

  } catch (error) {
    console.error("❌ Error uploading invoice:", error);
    res.status(500).json({ error: "Failed to upload invoice", details: error.message });
  }
});

export default router;
