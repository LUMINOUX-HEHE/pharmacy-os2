import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const dayMs = 24 * 60 * 60 * 1000;
const now = new Date();

const categories = ["TABLET", "SYRUP", "INJECTION", "CAPSULE", "CREAM", "OINTMENT", "DROPS", "SUPPLEMENT", "DEVICE", "INHALER"] as const;

const namesByCategory: Record<(typeof categories)[number], string[]> = {
  TABLET: ["Paracetamol 500mg", "Metformin 500mg", "Atorvastatin 10mg", "Cetirizine 10mg", "Ibuprofen 400mg", "Amlodipine 5mg", "Telmisartan 40mg", "Losartan 50mg", "Montelukast 10mg", "Levothyroxine 50mcg"],
  SYRUP: ["Benadryl Cough Syrup", "Ascoril LS Syrup", "Alex Junior Syrup", "Crocin Kids Syrup", "Digene Syrup", "Lactulose Syrup", "Zedex Cough Syrup", "Grilinctus Syrup", "Ambrodil Syrup", "Calcimax Syrup"],
  INJECTION: ["Pantoprazole Injection", "Ceftriaxone 1g Injection", "Diclofenac Injection", "Ondansetron Injection", "Vitamin B12 Injection", "Insulin Regular Injection", "Amikacin Injection", "Dexamethasone Injection", "Ranitidine Injection", "Tramadol Injection"],
  CAPSULE: ["Omeprazole 20mg", "Amoxicillin 250mg", "Azithromycin 500mg", "Doxycycline 100mg", "Pregabalin 75mg", "Gabapentin 300mg", "Rabeprazole DSR", "Vitamin E Capsule", "Mecobalamin Capsule", "Fluconazole 150mg"],
  CREAM: ["Soframycin Cream", "Betnovate C Cream", "Candid B Cream", "Quadriderm Cream", "Lobate GM Cream", "Fucidin Cream", "Moisturex Cream", "Elovera Cream", "Tenovate Cream", "Panderm Plus Cream"],
  OINTMENT: ["Betadine Ointment", "T-Bact Ointment", "Neosporin Ointment", "Silverex Ointment", "Burnol Ointment", "Voveran Emulgel", "Volini Gel", "Moov Pain Gel", "Dologel CT", "Himalaya Pilex Ointment"],
  DROPS: ["Ciplox Eye Drops", "Moxiflox Eye Drops", "Refresh Tears", "Otrivin Nasal Drops", "Soliwax Ear Drops", "Candibiotic Ear Drops", "Tobramycin Eye Drops", "Olopat Eye Drops", "Oflox Eye Drops", "Carboxymethylcellulose Drops"],
  SUPPLEMENT: ["Zincovit Tablet", "Shelcal 500", "Supradyn Daily", "Becosules Capsule", "Neurobion Forte", "Limcee 500", "A to Z NS", "Calcimax Forte", "Himalaya Septilin", "Dabur Chyawanprash"],
  DEVICE: ["Digital Thermometer", "Glucometer Strips", "BP Monitor", "Nebulizer Machine", "Pulse Oximeter", "Insulin Syringe", "Surgical Mask Pack", "Hot Water Bag", "Pregnancy Test Kit", "Crepe Bandage"],
  INHALER: ["Asthalin Inhaler", "Budecort 200 Inhaler", "Foracort 200 Inhaler", "Duolin Inhaler", "Seroflo 250 Inhaler", "Levolin Inhaler", "Tiova Inhaler", "Aerocort Inhaler", "Rotahaler Device", "Nasoclear Spray"]
};

const manufacturers = ["Sun Pharma", "Cipla", "Dr Reddy's", "Alkem", "Torrent", "Glenmark", "Abbott", "Mankind", "Zydus", "Intas"];
const customerNames = [
  "Aarav Sharma", "Vihaan Mehta", "Aditya Patil", "Arjun Nair", "Sai Iyer", "Reyansh Shah", "Mohammed Khan", "Rohan Desai", "Kabir Joshi", "Atharva Kulkarni",
  "Anaya Gupta", "Diya Shah", "Ira Menon", "Myra Kapoor", "Saanvi Rao", "Aadhya Singh", "Kiara Jain", "Avni Pawar", "Nisha Shetty", "Pooja Mishra",
  "Rajesh Verma", "Suresh Yadav", "Vikram Malhotra", "Imran Shaikh", "Prakash Jadhav", "Kiran More", "Deepak Chavan", "Nitin Bhosale", "Manoj Pillai", "Amit Gokhale",
  "Sunita Rao", "Meena Joshi", "Kavita Iyer", "Farah Khan", "Lata Patil", "Smita Desai", "Neha Kulkarni", "Ritu Shah", "Anjali Nair", "Priya Mehta",
  "Harish Shetty", "Ganesh Pawar", "Sameer Ansari", "Mahesh Gupta", "Joseph Dsouza", "Ramesh Solanki", "Sanjay Parmar", "Vijay Naik", "Ajay Tiwari", "Mohan Rane"
];

const mumbaiAddresses = [
  "Andheri West, Mumbai 400058", "Bandra West, Mumbai 400050", "Dadar East, Mumbai 400014", "Borivali West, Mumbai 400092", "Ghatkopar East, Mumbai 400077",
  "Powai, Mumbai 400076", "Chembur, Mumbai 400071", "Mulund West, Mumbai 400080", "Malad West, Mumbai 400064", "Vile Parle East, Mumbai 400057"
];

const paise = (rupees: number) => rupees * 100;
const dateDaysFromNow = (days: number) => new Date(now.getTime() + days * dayMs);
const billNo = (index: number) => `BILL-${dateDaysFromNow(-index).toISOString().slice(0, 10).replaceAll("-", "")}-${String(index + 1).padStart(4, "0")}`;

const calculateBill = (items: { mrp: number; quantity: number; gstRate: number; discountPercent: number }[]) => {
  const lines = items.map((item) => {
    const gross = item.mrp * item.quantity;
    const discount = Math.round((gross * item.discountPercent) / 100);
    const taxable = gross - discount;
    const gst = Math.round((taxable * item.gstRate) / 100);
    return { ...item, discount, taxable, gst, amount: taxable + gst };
  });
  return {
    lines,
    subtotal: lines.reduce((sum, line) => sum + line.taxable, 0),
    gstAmount: lines.reduce((sum, line) => sum + line.gst, 0),
    discount: lines.reduce((sum, line) => sum + line.discount, 0),
    totalAmount: lines.reduce((sum, line) => sum + line.amount, 0)
  };
};

const clear = async () => {
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.reminderLog.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.creditLedger.deleteMany();
  await prisma.pOItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.orderStatusLog.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.billItem.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.storeSetting.deleteMany();
  await prisma.deliveryDriver.deleteMany();
  await prisma.distributor.deleteMany();
  await prisma.medicine.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.user.deleteMany();
  await prisma.pharmacy.deleteMany();
  await prisma.analyticsSnapshot.deleteMany();
};

const main = async () => {
  await clear();
  const passwordHash = await bcrypt.hash("Demo@1234", 12);
  const pharmacy = await prisma.pharmacy.create({
    data: {
      name: "Sharma Medical Store",
      slug: "sharma-medical",
      licenseNo: "MH-MUM-2024-001",
      gstin: "27AABCS1429B1Z1",
      address: "Shop 12, S V Road, Andheri West",
      city: "Mumbai",
      state: "Maharashtra",
      pinCode: "400058",
      phone: "+919820001234",
      plan: "GROWTH",
      planExpiresAt: dateDaysFromNow(365),
      storeSetting: {
        create: {
          enabled: true,
          description: "Trusted medicines and fast local delivery from Sharma Medical Store.",
          tagline: "Genuine medicines delivered across Mumbai.",
          deliveryRadiusKm: 7,
          minimumOrderValue: paise(199),
          deliveryFee: paise(25),
          acceptedPayments: ["CASH", "UPI", "CARD"],
          operatingHours: { monday: ["09:00", "22:00"], tuesday: ["09:00", "22:00"], wednesday: ["09:00", "22:00"], thursday: ["09:00", "22:00"], friday: ["09:00", "22:00"], saturday: ["09:00", "22:00"], sunday: ["10:00", "21:00"] }
        }
      },
      subscriptions: { create: { plan: "GROWTH", status: "ACTIVE", razorpaySubId: "sub_demo_growth", currentPeriodStart: dateDaysFromNow(-10), currentPeriodEnd: dateDaysFromNow(20) } }
    }
  });

  const owner = await prisma.user.create({ data: { email: "admin@demo.com", passwordHash, role: "OWNER", pharmacyId: pharmacy.id, isVerified: true, staff: { create: { pharmacyId: pharmacy.id, role: "OWNER" } } } });
  await prisma.user.create({ data: { email: "staff@demo.com", passwordHash, role: "BILLING_STAFF", pharmacyId: pharmacy.id, isVerified: true, staff: { create: { pharmacyId: pharmacy.id, role: "BILLING" } } } });

  const medicines = [];
  for (const [categoryIndex, category] of categories.entries()) {
    for (let itemIndex = 0; itemIndex < 10; itemIndex += 1) {
      const index = categoryIndex * 10 + itemIndex;
      const mrp = paise(10 + ((index * 37) % 491));
      const expiryOffset = index % 20 === 0 ? -20 : index % 8 === 0 ? 15 + itemIndex : 90 + index * 9;
      const stockQty = index % 13 === 0 ? 0 : (index * 17) % 201;
      const scheduleType = index % 20 === 0 ? "H1" : index % 7 === 0 || index % 11 === 0 ? "H" : "GENERAL";
      medicines.push(await prisma.medicine.create({
        data: {
          pharmacyId: pharmacy.id,
          name: namesByCategory[category][itemIndex] ?? `${category} Medicine ${itemIndex + 1}`,
          genericName: namesByCategory[category][itemIndex]?.split(" ")[0] ?? "Generic",
          sku: `SMS-${String(index + 1).padStart(4, "0")}`,
          category,
          manufacturer: manufacturers[index % manufacturers.length] ?? "Cipla",
          batchNo: `BATCH-${String(index + 1).padStart(3, "0")}`,
          expiryDate: dateDaysFromNow(expiryOffset),
          mfgDate: dateDaysFromNow(-365 - index),
          mrp,
          purchasePrice: Math.round(mrp * 0.68),
          gstRate: [5, 12, 18][index % 3] ?? 12,
          hsnCode: category === "DEVICE" ? "9018" : "3004",
          stockQty,
          reorderLevel: 15 + (index % 20),
          scheduleType,
          barcodeId: `89012345${String(index + 1).padStart(5, "0")}`,
          isOnline: index % 6 !== 0,
          onlinePrice: Math.round(mrp * 0.97)
        }
      }));
    }
  }

  const customers = [];
  for (let index = 0; index < 50; index += 1) {
    customers.push(await prisma.customer.create({
      data: {
        pharmacyId: pharmacy.id,
        name: customerNames[index] ?? `Customer ${index + 1}`,
        phone: `+9198${String(20000000 + index).padStart(8, "0")}`,
        email: index % 4 === 0 ? `customer${index + 1}@demo.com` : null,
        address: mumbaiAddresses[index % mumbaiAddresses.length],
        creditBalance: index >= 45 ? paise(500 + (index - 44) * 250) : 0,
        tags: index < 30 ? ["Active"] : index < 45 ? ["Dormant"] : ["Credit"],
        birthday: index % 5 === 0 ? dateDaysFromNow(-365 * (28 + (index % 35))) : null,
        createdAt: dateDaysFromNow(index < 30 ? -index : -120 - index)
      }
    }));
  }

  const paymentModes = [...Array(15).fill("CASH"), ...Array(9).fill("UPI"), ...Array(6).fill("CREDIT")] as const;
  for (let index = 0; index < 30; index += 1) {
    const customer = customers[index];
    const picked = [medicines[index], medicines[(index + 11) % medicines.length]];
    const quantities = [1 + (index % 3), 1 + (index % 2)];
    const calculated = calculateBill(picked.map((medicine, itemIndex) => ({ mrp: medicine.mrp, quantity: quantities[itemIndex], gstRate: medicine.gstRate, discountPercent: index % 5 })));
    const mode = paymentModes[index]!;
    const bill = await prisma.bill.create({
      data: {
        pharmacyId: pharmacy.id,
        billNo: billNo(index),
        patientName: customer.name,
        patientPhone: customer.phone,
        doctorName: index % 4 === 0 ? "Dr. Meera Joshi" : null,
        paymentMode: mode,
        subtotal: calculated.subtotal,
        gstAmount: calculated.gstAmount,
        discount: calculated.discount,
        totalAmount: Math.min(Math.max(calculated.totalAmount, paise(150)), paise(2500)),
        status: mode === "CREDIT" ? "CREDIT" : "PAID",
        createdBy: owner.id,
        createdAt: dateDaysFromNow(-index),
        items: { create: picked.map((medicine, itemIndex) => ({ medicineId: medicine.id, quantity: quantities[itemIndex], mrp: medicine.mrp, discount: calculated.lines[itemIndex].discount, gstRate: medicine.gstRate, amount: calculated.lines[itemIndex].amount })) }
      }
    });
    for (const [itemIndex, medicine] of picked.entries()) {
      await prisma.medicine.update({ where: { id: medicine.id }, data: { stockQty: { decrement: quantities[itemIndex] } } });
    }
    if (mode === "CREDIT") {
      await prisma.creditLedger.create({ data: { customerId: customer.id, type: "DEBIT", amount: bill.totalAmount, description: `Credit bill ${bill.billNo}`, billId: bill.id, createdAt: bill.createdAt } });
      await prisma.customer.update({ where: { id: customer.id }, data: { creditBalance: { increment: bill.totalAmount } } });
    }
  }

  for (let index = 0; index < 10; index += 1) {
    await prisma.reminder.create({ data: { pharmacyId: pharmacy.id, customerId: customers[index].id, medicineId: medicines[(index * 3) % medicines.length].id, frequency: index % 2 === 0 ? "WEEKLY" : "MONTHLY", nextSendAt: dateDaysFromNow(2 + index * 3), isActive: true } });
  }

  const orderStatuses = ["NEW", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"] as const;
  for (const [index, status] of orderStatuses.entries()) {
    const customer = customers[10 + index];
    const medicine = medicines[40 + index];
    const quantity = 1 + (index % 2);
    const price = medicine.onlinePrice ?? medicine.mrp;
    const subtotal = price * quantity;
    const deliveryFee = paise(25);
    await prisma.order.create({
      data: {
        pharmacyId: pharmacy.id,
        customerId: customer.id,
        status,
        subtotal,
        deliveryFee,
        total: subtotal + deliveryFee,
        paymentMode: "CASH",
        paymentStatus: status === "DELIVERED" ? "PAID" : "PENDING",
        notes: `Seed ${status.toLowerCase().replaceAll("_", " ")} storefront order`,
        createdAt: dateDaysFromNow(-index),
        items: { create: { medicineId: medicine.id, quantity, price } },
        timeline: {
          create: {
            status,
            note: status === "NEW" ? "Order placed from public storefront" : `Order moved to ${status}`
          }
        }
      }
    });
    await prisma.medicine.update({ where: { id: medicine.id }, data: { stockQty: { decrement: quantity } } });
  }

  const distributorNames = ["Mehta Pharma Distributors", "Sai Medical Supplies", "Mumbai Surgical Depot", "Wellcare Pharma Agency", "Shree Ganesh Medicines"];
  const distributors = [];
  for (const [index, name] of distributorNames.entries()) {
    distributors.push(await prisma.distributor.create({ data: { pharmacyId: pharmacy.id, name, contactPerson: customerNames[35 + index], phone: `+9197${String(30000000 + index).padStart(8, "0")}`, email: `${name.toLowerCase().replaceAll(" ", ".")}@demo.com`, categories: [categories[index], categories[(index + 4) % categories.length]], gstin: `27AABCM${String(1000 + index)}B1Z${index}` } }));
  }

  const poSpecs = [
    { id: "PO-001", status: "DRAFT" as const, count: 5, sentAt: null, receivedAt: null },
    { id: "PO-002", status: "SENT" as const, count: 8, sentAt: dateDaysFromNow(-3), receivedAt: null },
    { id: "PO-003", status: "RECEIVED" as const, count: 6, sentAt: dateDaysFromNow(-6), receivedAt: dateDaysFromNow(-2) }
  ];
  for (const [poIndex, spec] of poSpecs.entries()) {
    const picked = medicines.slice(poIndex * 10, poIndex * 10 + spec.count);
    await prisma.purchaseOrder.create({ data: { id: spec.id, pharmacyId: pharmacy.id, distributorId: distributors[poIndex].id, status: spec.status, sentAt: spec.sentAt, receivedAt: spec.receivedAt, totalAmount: picked.reduce((sum, medicine) => sum + medicine.purchasePrice * 12, 0), notes: `${spec.id} demo purchase order`, items: { create: picked.map((medicine) => ({ medicineId: medicine.id, quantity: 12, purchasePrice: medicine.purchasePrice })) } } });
    if (spec.status === "RECEIVED") {
      for (const medicine of picked) {
        await prisma.medicine.update({ where: { id: medicine.id }, data: { stockQty: { increment: 12 } } });
      }
    }
  }

  for (let index = 0; index < 90; index += 1) {
    const date = dateDaysFromNow(-89 + index);
    date.setHours(0, 0, 0, 0);
    await prisma.analyticsSnapshot.create({ data: { pharmacyId: pharmacy.id, date, revenue: paise(3000 + ((index * 137) % 12001)), orders: 2 + (index % 7), newCustomers: index % 4, topSku: medicines[index % medicines.length].sku } });
  }

  const counts = {
    medicines: await prisma.medicine.count({ where: { pharmacyId: pharmacy.id } }),
    customers: await prisma.customer.count({ where: { pharmacyId: pharmacy.id } }),
    bills: await prisma.bill.count({ where: { pharmacyId: pharmacy.id } }),
    reminders: await prisma.reminder.count({ where: { pharmacyId: pharmacy.id } }),
    distributors: await prisma.distributor.count({ where: { pharmacyId: pharmacy.id } }),
    purchaseOrders: await prisma.purchaseOrder.count({ where: { pharmacyId: pharmacy.id } })
  };
  console.log(`${counts.medicines} medicines, ${counts.customers} customers, ${counts.bills} bills, ${counts.reminders} reminders, ${counts.distributors} distributors, ${counts.purchaseOrders} POs`);
  console.log("Demo login: admin@demo.com / Demo@1234");
};

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
