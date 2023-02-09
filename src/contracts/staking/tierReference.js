const tierReference = {
  0: {
    Backer: { allocation: "15", required: "2000000000000000000000" },
    Starter: { allocation: "75", required: "6000000000000000000000" },
    Investor: { allocation: "150", required: "10000000000000000000000" },
    Strategist: { allocation: "350", required: "25000000000000000000000" },
    Venturist: { allocation: "750", required: "50000000000000000000000" },
    Evangelist: { allocation: "1125", required: "70000000000000000000000" },
  },
  30: {
    Backer: { allocation: "30", required: "2000000000000000000000" },
    Starter: { allocation: "115", required: "6000000000000000000000" },
    Investor: { allocation: "225", required: "10000000000000000000000" },
    Strategist: { allocation: "550", required: "25000000000000000000000" },
    Venturist: { allocation: "1125", required: "50000000000000000000000" },
    Evangelist: { allocation: "1650", required: "70000000000000000000000" },
  },
  60: {
    Backer: { allocation: "60", required: "2000000000000000000000" },
    Starter: { allocation: "225", required: "6000000000000000000000" },
    Investor: { allocation: "350", required: "10000000000000000000000" },
    Strategist: { allocation: "825", required: "25000000000000000000000" },
    Venturist: { allocation: "1650", required: "50000000000000000000000" },
    Evangelist: { allocation: "2350", required: "70000000000000000000000" },
  },
  90: {
    Backer: { allocation: "200", required: "2000000000000000000000" },
    Starter: { allocation: "600", required: "6000000000000000000000" },
    Investor: { allocation: "850", required: "10000000000000000000000" },
    Strategist: { allocation: "1650", required: "25000000000000000000000" },
    Venturist: { allocation: "2350", required: "50000000000000000000000" },
    Evangelist: { allocation: "3000", required: "70000000000000000000000" },
    "Evangelist Pro": {
      allocation: "7500",
      required: "300000000000000000000000",
    },
  },
};

const lockReference = {
  1: 0,
  2: 30,
  3: 60,
  4: 90,
};

const nameReference = {
  1: "Backer",
  2: "Starter",
  3: "Investor",
  4: "Strategist",
  5: "Venturist",
  6: "Evangelist",
  7: "Evangelist Pro",
};

module.exports = { tierReference, lockReference, nameReference };
