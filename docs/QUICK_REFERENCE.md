# Quick Reference Guide - Invoice System

## For Technicians

### How to Generate an Invoice

1. **Complete the Job First**
   - Go to "My Jobs"
   - Click on a job
   - Toggle status to "Completed" ✅

2. **Navigate to Invoice Tab**
   - Click "Invoice" in the sidebar
   - Click "+ New Invoice" button

3. **Fill Invoice Details**
   - **Select Job**: Choose from completed jobs dropdown
   - **Customer Info**: Auto-filled (can edit if needed)
   - **Service Type**: Describe the service performed
   - **Add Components**: 
     - Click "+ Add Component"
     - Select from your stock
     - Enter quantity used
     - Enter amount charged
   - **Service Charge**: Enter labor/service fee
   - **Payment Mode**: Select Cash/UPI/Card/Bank Transfer
   - **Transaction ID**: Enter if payment was digital
   - **Remarks**: Add any notes (optional)

4. **Review Total**
   - Check the total amount calculation
   - Components Cost + Service Charge = Total

5. **Generate Invoice**
   - Click "📄 Generate Invoice"
   - Stock will be automatically reduced
   - Invoice sent to admin

6. **View & Share**
   - Click on generated invoice to view
   - **Download PDF**: Click "📥 Download PDF"
   - **Share WhatsApp**: Click "📱 Share on WhatsApp"

---

## For Admin

### How to Add a Technician

1. Go to "Technicians" tab
2. Click "+ Add Technician"
3. Fill in details:
   - Full Name
   - Email
   - Password
   - Phone Number
4. Click "Add Technician"
5. **Important**: You will be logged out
6. Log back in with your admin credentials

### How to View Invoices

1. Dashboard shows notification badge if new invoices
2. Go to "Invoices" tab
3. Click on any invoice to view details
4. Mark as reviewed

### How to Assign Stock

1. Go to "Inventory" section
2. Click "Assign Stock"
3. Select technician
4. Select product and quantity
5. Click "Assign"

---

## Bill Format Reference

```
┌─────────────────────────────────────────┐
│      FRIENDS AQUA CARE                  │
│   Water Purifier Sales & Service       │
│                                         │
│  📍 Office Address                      │
│  📞 Phone Number                        │
│  📧 Email                               │
├─────────────────────────────────────────┤
│                                         │
│      SERVICE BILL / INVOICE             │
│                                         │
│  Bill No: FAC2405XXXX    Date: DD/MM/YY│
├─────────────────────────────────────────┤
│  CUSTOMER DETAILS                       │
│  • Customer Name                        │
│  • Phone Number                         │
│  • Location / Address                   │
├─────────────────────────────────────────┤
│  SERVICE DETAILS                        │
│  • Service Type                         │
│  • Technician Name                      │
├─────────────────────────────────────────┤
│  COMPONENTS USED                        │
│  ┌────┬──────────┬─────┬────────┐      │
│  │S.No│Component │ Qty │ Amount │      │
│  ├────┼──────────┼─────┼────────┤      │
│  │ 1  │ Filter   │  2  │  ₹500  │      │
│  └────┴──────────┴─────┴────────┘      │
├─────────────────────────────────────────┤
│  PAYMENT DETAILS                        │
│  Service Charge:        ₹ 300          │
│  Components Cost:       ₹ 500          │
│  ─────────────────────────────         │
│  Total Amount:          ₹ 800          │
│                                         │
│  Payment Mode:                          │
│  ☑ Cash  ☐ UPI  ☐ Card  ☐ Transfer    │
│                                         │
│  Transaction ID: (if applicable)        │
├─────────────────────────────────────────┤
│  REMARKS                                │
│  (Optional notes)                       │
├─────────────────────────────────────────┤
│                                         │
│  _______________    _______________    │
│  Customer Sign      Technician Sign    │
│                                         │
├─────────────────────────────────────────┤
│  Thank you for choosing                 │
│  FRIENDS AQUA CARE                      │
└─────────────────────────────────────────┘
```

---

## Tips & Best Practices

### For Technicians:

1. **Always mark job as completed** before generating invoice
2. **Double-check quantities** - stock will be reduced automatically
3. **Add remarks** for any special notes or warranty info
4. **Download PDF** before sharing to customer
5. **Use WhatsApp share** for instant delivery to customer

### For Admin:

1. **Review invoices regularly** to track technician performance
2. **Assign adequate stock** to technicians before jobs
3. **Monitor stock levels** in inventory dashboard
4. **After adding technician**, save your password before re-login

---

## Troubleshooting

### Invoice not generating?
- Ensure job is marked as "Completed"
- Check if you have stock assigned
- Verify all required fields are filled

### Stock not reducing?
- Check if component name matches exactly
- Verify stock assignment exists
- Contact admin if issue persists

### PDF not downloading?
- Allow pop-ups in browser
- Check browser download settings
- Try different browser if issue persists

### WhatsApp not opening?
- Ensure WhatsApp is installed
- Check phone number format (10 digits)
- Try WhatsApp Web if on desktop

---

## Keyboard Shortcuts

- `Esc` - Close modal
- `Enter` - Submit form (when focused)
- `Tab` - Navigate between fields

---

## Support

For technical issues or questions:
- Contact: Admin
- Email: friendsaquacare@gmail.com
- Phone: +91 9876543210

---

**Last Updated**: May 2024
**Version**: 2.0
