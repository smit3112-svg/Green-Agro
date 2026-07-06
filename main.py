"""
Green Agro API — FastAPI + MongoDB Atlas
"""
import os, random
from contextlib import asynccontextmanager
from datetime import datetime

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import Optional

# ── Environment ───────────────────────────────────────────────────────────────
load_dotenv()
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "green_agro")

# ── MongoDB client (module-level, shared across requests) ─────────────────────
client: AsyncIOMotorClient = None
db = None


def get_db():
    return db


# ── Helpers ───────────────────────────────────────────────────────────────────
def to_json(doc: dict) -> dict:
    """Convert MongoDB document to JSON-serialisable dict."""
    if doc is None:
        return None
    doc = dict(doc)
    doc.pop("_id", None)
    return doc


# ── Seed data ─────────────────────────────────────────────────────────────────
SEED_PICKUPS = [
    {
        "id": "PKP001", "farmer": "Ramesh Patel", "material": "Wheat Straw",
        "quantity": 5, "location": "Village Center, Anand", "date": "2025-05-21",
        "status": "In Progress", "amount": 10750,
    },
    {
        "id": "PKP002", "farmer": "Ramesh Patel", "material": "Rice Straw",
        "quantity": 3, "location": "Petlad, Anand", "date": "2025-05-08",
        "status": "Completed", "amount": 6450,
    },
]

SEED_ORDERS = [
    {
        "id": "GA1256", "buyer": "Arjun Industries", "pellet": "8mm Pellet",
        "quantity": 20, "destination": "Ankleshwar, Gujarat", "date": "2025-05-23",
        "status": "On the Way", "amount": 120000,
    },
]

SEED_TRANSACTIONS = [
    {"id": "TXN001", "type": "credit", "label": "Pickup #PKP001",  "amount": 8600,  "date": "2025-05-15", "method": "UPI"},
    {"id": "TXN002", "type": "credit", "label": "Pickup #PKP002",  "amount": 7850,  "date": "2025-05-08", "method": "Bank Transfer"},
    {"id": "TXN003", "type": "debit",  "label": "Payment #GA1256", "amount": 60000, "date": "2025-05-12", "method": "NEFT"},
]

SEED_WALLET = {"key": "wallet", "balance": 12450}


async def seed_db():
    """Insert seed data only if collections are empty."""
    if await db.pickups.count_documents({}) == 0:
        await db.pickups.insert_many(SEED_PICKUPS)

    if await db.orders.count_documents({}) == 0:
        await db.orders.insert_many(SEED_ORDERS)

    if await db.transactions.count_documents({}) == 0:
        await db.transactions.insert_many(SEED_TRANSACTIONS)

    if await db.wallet.count_documents({}) == 0:
        await db.wallet.insert_one(SEED_WALLET)


# ── App lifecycle ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global client, db
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]
    await seed_db()
    yield
    client.close()


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(title="Green Agro API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic Schemas ──────────────────────────────────────────────────────────
class PickupRequest(BaseModel):
    farmer: str
    material: str
    quantity: float
    location: str
    date: str


class OrderRequest(BaseModel):
    buyer: str
    pellet: str
    quantity: float
    destination: str
    date: str


class PaymentRequest(BaseModel):
    order_id: str
    amount: float
    method: str          # upi | card | netbanking | neft
    upi_id: Optional[str] = None
    card_number: Optional[str] = None
    card_name: Optional[str] = None
    card_expiry: Optional[str] = None
    card_cvv: Optional[str] = None


class WithdrawRequest(BaseModel):
    amount: float
    method: str          # upi | bank
    upi_id: Optional[str] = None
    account_number: Optional[str] = None
    ifsc: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"status": "Green Agro API running", "version": "1.0.0"}


@app.get("/prices")
async def get_prices():
    return {
        "wheat_straw":       {"price": 2150, "unit": "ton", "change": "+2.4%"},
        "rice_straw":        {"price": 1950, "unit": "ton", "change": "-0.8%"},
        "sugarcane_bagasse": {"price": 2400, "unit": "ton", "change": "+1.1%"},
        "cotton_stalks":     {"price": 1800, "unit": "ton", "change": "+3.2%"},
    }


@app.get("/farmer/{farmer_id}/dashboard")
async def farmer_dashboard(farmer_id: str):
    cursor = db.pickups.find({"farmer": "Ramesh Patel"})
    my_pickups = [to_json(p) async for p in cursor]
    earned = sum(p["amount"] for p in my_pickups if p["status"] == "Completed")
    wallet_doc = to_json(await db.wallet.find_one({"key": "wallet"}))
    return {
        "name": "Ramesh Patel",
        "location": "Anand, Gujarat",
        "wallet_balance": wallet_doc["balance"] if wallet_doc else 0,
        "total_pickups": len(my_pickups),
        "total_collected_mt": sum(p["quantity"] for p in my_pickups),
        "total_earned": earned,
        "next_pickup": my_pickups[0] if my_pickups else None,
    }


@app.post("/pickups")
async def create_pickup(req: PickupRequest):
    pid = "PKP" + str(random.randint(100, 999))
    entry = {
        **req.model_dump(),
        "id": pid,
        "status": "Confirmed",
        "amount": req.quantity * 2150,
    }
    await db.pickups.insert_one(entry)
    return {"success": True, "pickup_id": pid, "message": "Pickup booked!", "data": to_json(entry)}


@app.get("/pickups/{pickup_id}/track")
async def track_pickup(pickup_id: str):
    p = to_json(await db.pickups.find_one({"id": pickup_id}))
    if not p:
        raise HTTPException(status_code=404, detail="Pickup not found")
    steps = ["Booked", "Confirmed", "En route", "Picked up", "Done"]
    current = {"Confirmed": 1, "In Progress": 2, "Completed": 4}.get(p["status"], 0)
    return {**p, "steps": steps, "current_step": current}


@app.get("/buyer/{buyer_id}/dashboard")
async def buyer_dashboard(buyer_id: str):
    cursor = db.orders.find({"buyer": "Arjun Industries"})
    my_orders = [to_json(o) async for o in cursor]
    return {
        "name": "Arjun",
        "company": "Arjun Industries",
        "location": "Ankleshwar, Gujarat",
        "current_order_mt": sum(o["quantity"] for o in my_orders),
        "outstanding": sum(o["amount"] for o in my_orders if o["status"] != "Delivered"),
        "next_delivery": my_orders[0] if my_orders else None,
    }


@app.post("/orders")
async def create_order(req: OrderRequest):
    oid = "GA" + str(random.randint(1000, 9999))
    entry = {
        **req.model_dump(),
        "id": oid,
        "buyer": req.buyer or "Arjun Industries",
        "status": "Processing",
        "amount": req.quantity * 6000,
    }
    await db.orders.insert_one(entry)
    return {"success": True, "order_id": oid, "message": "Order placed!", "data": to_json(entry)}


@app.get("/orders/{order_id}/track")
async def track_order(order_id: str):
    o = to_json(await db.orders.find_one({"id": order_id}))
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    steps = ["Placed", "Processing", "Shipped", "On the Way", "Delivered"]
    current = {"Placed": 0, "Processing": 1, "Shipped": 2, "On the Way": 3, "Delivered": 4}.get(o["status"], 0)
    return {**o, "steps": steps, "current_step": current}


@app.post("/payments")
async def make_payment(req: PaymentRequest):
    order = to_json(await db.orders.find_one({"id": req.order_id}))
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if req.amount <= 0 or req.amount > order["amount"]:
        raise HTTPException(status_code=400, detail="Invalid amount")

    txn_id = "TXN" + str(random.randint(1000, 9999))
    txn = {
        "id": txn_id, "type": "debit",
        "label": f"Payment #{req.order_id}",
        "amount": req.amount, "method": req.method,
        "date": datetime.today().strftime("%Y-%m-%d"),
    }
    await db.transactions.insert_one(txn)
    await db.orders.update_one({"id": req.order_id}, {"$set": {"status": "Paid"}})
    return {
        "success": True, "txn_id": txn_id,
        "message": f"Payment of ₹{req.amount:,.0f} successful via {req.method}",
    }


@app.post("/wallet/withdraw")
async def withdraw(req: WithdrawRequest):
    wallet_doc = to_json(await db.wallet.find_one({"key": "wallet"}))
    balance = wallet_doc["balance"] if wallet_doc else 0

    if req.amount > balance:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    new_balance = balance - req.amount
    await db.wallet.update_one({"key": "wallet"}, {"$set": {"balance": new_balance}})

    txn_id = "TXN" + str(random.randint(1000, 9999))
    txn = {
        "id": txn_id, "type": "debit",
        "label": "Withdrawal",
        "amount": req.amount, "method": req.method,
        "date": datetime.today().strftime("%Y-%m-%d"),
    }
    await db.transactions.insert_one(txn)
    return {
        "success": True, "txn_id": txn_id,
        "new_balance": new_balance,
        "message": f"₹{req.amount:,.0f} withdrawn to {req.method}",
    }


@app.get("/transactions")
async def get_transactions():
    cursor = db.transactions.find().sort("date", -1)
    txns = [to_json(t) async for t in cursor]
    wallet_doc = to_json(await db.wallet.find_one({"key": "wallet"}))
    return {"transactions": txns, "wallet_balance": wallet_doc["balance"] if wallet_doc else 0}


@app.get("/impact")
async def get_impact():
    cursor = db.pickups.find()
    all_pickups = [to_json(p) async for p in cursor]
    total_mt = sum(p["quantity"] for p in all_pickups)
    return {
        "total_straw_mt": 1250,
        "co2_reduced_tons": round(total_mt * 0.25, 1),
        "stubble_burning_prevented": 1240,
        "farmers_impacted": 340,
        "industries_connected": 28,
    }


# ── Serve frontend static files (must be LAST) ────────────────────────────────
import os as _os
_public_dir = _os.path.join(_os.path.dirname(__file__), "public")
if _os.path.isdir(_public_dir):
    app.mount("/", StaticFiles(directory=_public_dir, html=True), name="static")


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
