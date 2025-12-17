# Tai Live

The core decentralized streaming platform of the Tai Network.

## Overview
Tai Live enables creators to broadcast content, earn via "Cash, Clout, or Commitment" tiers, and interact with viewers through prediction markets and tipping.

## Components

### 1. Frontend (`/frontend`)
- **Stack**: Next.js 14, Tailwind CSS, Sui SDK
- **Features**: Dashboard, Stream View, Tipping, Predictions

### 2. Smart Contracts (`/contract`)
- **Language**: Sui Move
- **Modules**:
  - `user_profile`: Identity & Tiers (Staking/Fame/Effort)
  - `content`: Content publishing & gating
  - `reputation`: Cred scoring & jury system
  - `prediction`: Betting markets
  - `tipping`: Direct P2P tips

### 3. Backend (`/backend`)
- **Stack**: Node.js, Express
- **Purpose**: Off-chain coordination, indexer, oracle services (Enoki/Nautilus integration)

## Getting Started

### Smart Contracts
```bash
cd contract
sui move build
sui move test
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
npm start
```
