import React, { useState, useEffect } from 'react';

// Felson Wealth Management Portal - Full Stack
const FelsonWealthApp = () => {
  // ============ STATE ============
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null); // 'admin' or 'sibling'
  const [currentUser, setCurrentUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showMFA, setShowMFA] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanTerm, setLoanTerm] = useState(6);

  // Sibling data
  const [siblings, setSiblings] = useState([
    {
      id: 1,
      name: 'Tombra Prezi',
      age: 23,
      email: 'tombra@felsonwealth.com',
      password: 'tombra123',
      birthday: '2001-03-15',
      tier: 2,
      totalSaved: 78000,
      deposits: [
        { date: '2026-09-01', amount: 5000, match: 1500 },
        { date: '2026-08-01', amount: 5000, match: 1500 },
        { date: '2026-07-01', amount: 5000, match: 1500 },
      ],
      loans: [],
      goal: 'Business Capital',
      roleAssigned: null,
    },
    {
      id: 2,
      name: 'Sona Prezi',
      age: 23,
      email: 'sona@felsonwealth.com',
      password: 'sona123',
      birthday: '2003-07-22',
      tier: 2,
      totalSaved: 0,
      deposits: [],
      loans: [],
      goal: 'Education',
      roleAssigned: null,
    },
    {
      id: 3,
      name: 'Bovina Prezi',
      age: 26,
      email: 'bovina@felsonwealth.com',
      password: 'bovina123',
      birthday: '2000-05-10',
      tier: 3,
      totalSaved: 0,
      deposits: [],
      loans: [],
      goal: 'Investment',
      roleAssigned: 'FSS Field Technician',
    },
    {
      id: 4,
      name: 'Henry Prezi',
      age: 30,
      email: 'henry@felsonwealth.com',
      password: 'henry123',
      birthday: '1996-11-28',
      tier: 3,
      totalSaved: 0,
      deposits: [],
      loans: [],
      goal: 'Family Support',
      roleAssigned: null,
    },
    {
      id: 5,
      name: 'Gift Prezi',
      age: 28,
      email: 'gift@felsonwealth.com',
      password: 'gift123',
      birthday: '1998-02-14',
      tier: 3,
      totalSaved: 0,
      deposits: [],
      loans: [],
      goal: 'Savings',
      roleAssigned: null,
    },
  ]);

  const adminUser = {
    id: 'admin',
    name: 'Felson Prezi',
    email: 'Felsonprezi01@gmail.com',
    password: 'Felson@2026!',
    birthday: '1994-06-20',
  };

  // ============ TIER CONFIG ============
  const tiers = {
    1: { name: 'Tier 1', ages: '12-18', minSave: 2500, matchPercent: 35 },
    2: { name: 'Tier 2', ages: '18-25', minSave: 5000, matchPercent: 30 },
    3: { name: 'Tier 3', ages: '25+', minSave: 10000, matchPercent: 25 },
  };

  const getTierForAge = (age) => {
    if (age >= 12 && age <= 18) return 1;
    if (age >= 18 && age <= 25) return 2;
    if (age >= 25) return 3;
    return 1;
  };

  const calculateMatch = (amount, tier) => {
    return Math.round(amount * (tiers[tier].matchPercent / 100));
  };

  // ============ AUTH ============
  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError('');

    if (email === adminUser.email && password === adminUser.password) {
      setShowMFA(true);
      return;
    }

    const sibling = siblings.find(s => s.email === email && s.password === password);
    if (sibling) {
      setCurrentUser(sibling);
      setUserRole('sibling');
      setIsLoggedIn(true);
      setEmail('');
      setPassword('');
      return;
    }

    setLoginError('Invalid email or password');
  };

  const handleMFASubmit = (e) => {
    e.preventDefault();
    // Simple MFA check (in real app, would use TOTP)
    if (mfaCode === '123456') {
      setCurrentUser(adminUser);
      setUserRole('admin');
      setIsLoggedIn(true);
      setMFACode('');
      setShowMFA(false);
      setEmail('');
      setPassword('');
    } else {
      setLoginError('Invalid MFA code');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRole(null);
    setCurrentUser(null);
    setEmail('');
    setPassword('');
    setLoginError('');
  };

  // ============ DEPOSIT HANDLING ============
  const handleAddDeposit = (siblingId, amount) => {
    const sibling = siblings.find(s => s.id === siblingId);
    if (!sibling || amount < tiers[sibling.tier].minSave) {
      alert(`Minimum deposit for this tier is ₦${tiers[sibling.tier].minSave}`);
      return;
    }

    const match = calculateMatch(amount, sibling.tier);
    const newDeposit = {
      date: new Date().toISOString().split('T')[0],
      amount,
      match,
    };

    setSiblings(siblings.map(s => {
      if (s.id === siblingId) {
        return {
          ...s,
          totalSaved: s.totalSaved + amount + match,
          deposits: [...s.deposits, newDeposit],
        };
      }
      return s;
    }));
  };

  // ============ LOAN HANDLING ============
  const handleRequestLoan = (siblingId, loanAmount, term) => {
    const sibling = siblings.find(s => s.id === siblingId);
    if (!sibling || sibling.totalSaved < 100000) {
      alert('Minimum ₦100,000 saved required to request loan');
      return;
    }

    const interestRate = term === 6 ? 0 : 2;
    const monthlyPayment = Math.round(loanAmount / term);
    const totalInterest = Math.round((loanAmount * interestRate) / 100);

    const newLoan = {
      id: Date.now(),
      amount: loanAmount,
      term,
      interestRate,
      monthlyPayment,
      totalInterest,
      status: 'pending',
      requestDate: new Date().toISOString().split('T')[0],
      approvedDate: null,
      disbursedDate: null,
      paidToDate: 0,
    };

    setSiblings(siblings.map(s => {
      if (s.id === siblingId) {
        return {
          ...s,
          loans: [...s.loans, newLoan],
        };
      }
      return s;
    }));
  };

  // ============ ADMIN ACTIONS ============
  const handleApproveLoan = (siblingId, loanId) => {
    setSiblings(siblings.map(s => {
      if (s.id === siblingId) {
        return {
          ...s,
          loans: s.loans.map(l => {
            if (l.id === loanId) {
              return {
                ...l,
                status: 'approved',
                approvedDate: new Date().toISOString().split('T')[0],
                disbursedDate: new Date().toISOString().split('T')[0],
              };
            }
            return l;
          }),
        };
      }
      return s;
    }));
  };

  // ============ UI COMPONENTS ============
  if (!isLoggedIn) {
    return (
      <div style={styles.container}>
        <div style={styles.loginCard}>
          <div style={styles.logo}>
            <div style={styles.logoText}>FELSON</div>
            <div style={styles.logoSubtext}>WEALTH MANAGEMENT</div>
          </div>

          {showMFA ? (
            <form onSubmit={handleMFASubmit} style={styles.form}>
              <h2 style={styles.formTitle}>Multi-Factor Authentication</h2>
              <p style={styles.mfaInfo}>
                Check your authenticator app for the 6-digit code (demo code: 123456)
              </p>
              <input
                type="text"
                placeholder="000000"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                maxLength="6"
                style={styles.input}
              />
              {loginError && <div style={styles.error}>{loginError}</div>}
              <button type="submit" style={styles.primaryButton}>
                Verify Code
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMFA(false);
                  setMFACode('');
                }}
                style={styles.secondaryButton}
              >
                Back to Login
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} style={styles.form}>
              <h2 style={styles.formTitle}>Login</h2>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
              />
              {loginError && <div style={styles.error}>{loginError}</div>}
              <button type="submit" style={styles.primaryButton}>
                Login
              </button>
              <div style={styles.demoAccounts}>
                <p style={styles.demoTitle}>Demo Accounts:</p>
                <p>Admin: Felsonprezi01@gmail.com / Felson@2026!</p>
                <p>Sibling: tombra@felsonwealth.com / tombra123</p>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ============ ADMIN DASHBOARD ============
  if (userRole === 'admin') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.headerLogo}>F</div>
            <div>
              <h1 style={styles.headerTitle}>Felson Wealth Management</h1>
              <p style={styles.headerSubtitle}>Admin Dashboard</p>
            </div>
          </div>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Logout
          </button>
        </div>

        <div style={styles.adminGrid}>
          {/* Summary Cards */}
          <div style={styles.summaryRow}>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Total Family Savings</div>
              <div style={styles.summaryValue}>
                ₦{siblings.reduce((sum, s) => sum + s.totalSaved, 0).toLocaleString()}
              </div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Active Members</div>
              <div style={styles.summaryValue}>{siblings.length}</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Total Matched</div>
              <div style={styles.summaryValue}>
                ₦
                {siblings
                  .reduce((sum, s) => sum + s.deposits.reduce((d, dep) => d + dep.match, 0), 0)
                  .toLocaleString()}
              </div>
            </div>
          </div>

          {/* Upcoming Birthdays */}
          <div style={styles.sectionCard}>
            <h3 style={styles.sectionTitle}>📅 Upcoming Birthdays</h3>
            <div style={styles.birthdayList}>
              {[...siblings]
                .sort((a, b) => {
                  const getMonth = (bday) => parseInt(bday.split('-')[1]);
                  return getMonth(a.birthday) - getMonth(b.birthday);
                })
                .map((sibling) => (
                  <div key={sibling.id} style={styles.birthdayItem}>
                    <div style={styles.birthdayName}>{sibling.name}</div>
                    <div style={styles.birthdayDate}>
                      {new Date(sibling.birthday).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Siblings Overview */}
          {siblings.map((sibling) => (
            <div key={sibling.id} style={styles.siblingCard}>
              <div style={styles.siblingHeader}>
                <h3 style={styles.siblingName}>{sibling.name}</h3>
                <div style={styles.siblingMeta}>
                  Age {sibling.age} • {tiers[sibling.tier].name}
                </div>
              </div>

              <div style={styles.siblingStats}>
                <div style={styles.statItem}>
                  <div style={styles.statLabel}>Balance</div>
                  <div style={styles.statValue}>₦{sibling.totalSaved.toLocaleString()}</div>
                </div>
                <div style={styles.statItem}>
                  <div style={styles.statLabel}>Deposits</div>
                  <div style={styles.statValue}>{sibling.deposits.length}</div>
                </div>
                <div style={styles.statItem}>
                  <div style={styles.statLabel}>Loans</div>
                  <div style={styles.statValue}>{sibling.loans.length}</div>
                </div>
              </div>

              {sibling.roleAssigned && (
                <div style={styles.roleAssignedBadge}>
                  Role: {sibling.roleAssigned}
                </div>
              )}

              {/* Pending Loan Approvals */}
              {sibling.loans.some((l) => l.status === 'pending') && (
                <div style={styles.loanApprovalSection}>
                  <h4 style={styles.loanApprovalTitle}>Pending Loan Approvals</h4>
                  {sibling.loans
                    .filter((l) => l.status === 'pending')
                    .map((loan) => (
                      <div key={loan.id} style={styles.loanApprovalItem}>
                        <div>
                          <div>Amount: ₦{loan.amount.toLocaleString()}</div>
                          <div>Term: {loan.term} months</div>
                          <div>Interest: {loan.interestRate}%</div>
                        </div>
                        <button
                          onClick={() => handleApproveLoan(sibling.id, loan.id)}
                          style={styles.approveButton}
                        >
                          Approve
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ============ SIBLING PORTAL ============
  if (userRole === 'sibling' && currentUser) {
    const sibling = siblings.find((s) => s.id === currentUser.id);
    const tier = tiers[sibling.tier];
    const loanEligible = sibling.totalSaved >= 100000;

    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.headerLogo}>F</div>
            <div>
              <h1 style={styles.headerTitle}>Felson Wealth</h1>
              <p style={styles.headerSubtitle}>{sibling.name}</p>
            </div>
          </div>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Logout
          </button>
        </div>

        <div style={styles.portalGrid}>
          {/* Main Dashboard */}
          <div style={styles.dashboardCard}>
            <h2 style={styles.cardTitle}>Your Savings Dashboard</h2>

            <div style={styles.balanceSection}>
              <div style={styles.balanceLabel}>Current Balance</div>
              <div style={styles.balanceValue}>₦{sibling.totalSaved.toLocaleString()}</div>
            </div>

            <div style={styles.tierInfo}>
              <div style={styles.tierLabel}>{tier.name}</div>
              <div style={styles.tierDetails}>
                Minimum monthly: ₦{tier.minSave.toLocaleString()}
              </div>
              <div style={styles.tierDetails}>
                Your match rate: {tier.matchPercent}%
              </div>
            </div>

            {/* Deposit Form */}
            <div style={styles.formSection}>
              <h3 style={styles.formSectionTitle}>Add Monthly Deposit</h3>
              <input
                type="number"
                placeholder={`Min: ₦${tier.minSave}`}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                style={styles.input}
              />
              <div style={styles.matchPreview}>
                {depositAmount
                  ? `You save ₦${parseInt(depositAmount).toLocaleString()}, I add ₦${Math.round(
                      parseInt(depositAmount) * (tier.matchPercent / 100)
                    ).toLocaleString()}`
                  : 'Enter amount to see match'}
              </div>
              <button
                onClick={() => {
                  if (depositAmount) {
                    handleAddDeposit(sibling.id, parseInt(depositAmount));
                    setDepositAmount('');
                  }
                }}
                style={styles.primaryButton}
              >
                Record Deposit
              </button>
            </div>

            {/* Deposit History */}
            {sibling.deposits.length > 0 && (
              <div style={styles.historySection}>
                <h3 style={styles.formSectionTitle}>Recent Deposits</h3>
                {sibling.deposits.slice(-3).map((dep, idx) => (
                  <div key={idx} style={styles.historyItem}>
                    <div>
                      <div style={styles.historyDate}>{dep.date}</div>
                      <div style={styles.historyAmount}>₦{dep.amount.toLocaleString()}</div>
                    </div>
                    <div style={styles.historyMatch}>
                      +₦{dep.match.toLocaleString()} match
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Goal Card */}
          <div style={styles.dashboardCard}>
            <h2 style={styles.cardTitle}>Your Goal</h2>
            <div style={styles.goalSection}>
              <div style={styles.goalName}>{sibling.goal}</div>
              <div style={styles.progressBar}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${Math.min((sibling.totalSaved / 100000) * 100, 100)}%`,
                  }}
                />
              </div>
              <div style={styles.goalProgress}>
                ₦{sibling.totalSaved.toLocaleString()} / ₦100,000
              </div>
              <div style={styles.goalSubtext}>
                {sibling.totalSaved >= 100000
                  ? '✓ Eligible for loan!'
                  : `₦${(100000 - sibling.totalSaved).toLocaleString()} to go`}
              </div>
            </div>
          </div>

          {/* Loan Section */}
          {loanEligible && (
            <div style={styles.dashboardCard}>
              <h2 style={styles.cardTitle}>Request a Loan</h2>
              <div style={styles.loanForm}>
                <input
                  type="number"
                  placeholder="Loan amount"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  style={styles.input}
                />
                <select
                  value={loanTerm}
                  onChange={(e) => setLoanTerm(parseInt(e.target.value))}
                  style={styles.input}
                >
                  <option value={6}>6 months (0% interest)</option>
                  <option value={12}>12 months (2% interest)</option>
                </select>
                {loanAmount && (
                  <div style={styles.loanPreview}>
                    <div>
                      Amount: ₦{parseInt(loanAmount).toLocaleString()}
                    </div>
                    <div>
                      Interest: {loanTerm === 6 ? '0%' : '2%'}
                    </div>
                    <div>
                      Monthly payment: ₦
                      {Math.round(parseInt(loanAmount) / loanTerm).toLocaleString()}
                    </div>
                  </div>
                )}
                <button
                  onClick={() => {
                    if (loanAmount) {
                      handleRequestLoan(sibling.id, parseInt(loanAmount), loanTerm);
                      setLoanAmount('');
                    }
                  }}
                  style={styles.primaryButton}
                >
                  Request Loan
                </button>
              </div>

              {sibling.loans.length > 0 && (
                <div style={styles.loanHistorySection}>
                  <h3 style={styles.formSectionTitle}>Your Loans</h3>
                  {sibling.loans.map((loan) => (
                    <div key={loan.id} style={styles.loanStatusItem}>
                      <div>
                        <div style={styles.loanAmount}>
                          ₦{loan.amount.toLocaleString()}
                        </div>
                        <div style={styles.loanTerm}>
                          {loan.term}mo @ {loan.interestRate}%
                        </div>
                      </div>
                      <div
                        style={{
                          ...styles.loanStatus,
                          backgroundColor:
                            loan.status === 'pending'
                              ? '#ffeaa7'
                              : loan.status === 'approved'
                              ? '#55efc4'
                              : '#dfe6e9',
                        }}
                      >
                        {loan.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Milestones */}
          <div style={styles.dashboardCard}>
            <h2 style={styles.cardTitle}>Milestones</h2>
            <div style={styles.milestonesList}>
              <div style={styles.milestone(sibling.deposits.length >= 3)}>
                <div>✓</div>
                <div>3 Months Consistent Saving</div>
              </div>
              <div style={styles.milestone(sibling.totalSaved >= 100000)}>
                <div>✓</div>
                <div>₦100,000 Saved - Loan Eligible</div>
              </div>
              {sibling.roleAssigned && (
                <div style={styles.milestone(true)}>
                  <div>✓</div>
                  <div>Business Role Assigned: {sibling.roleAssigned}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
};

// ============ STYLES ============
const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  loginCard: {
    maxWidth: '400px',
    margin: '60px auto',
    background: 'white',
    borderRadius: '12px',
    padding: '40px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
  },
  logo: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  logoText: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#001a4d',
  },
  logoSubtext: {
    fontSize: '14px',
    color: '#0066cc',
    letterSpacing: '1px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  formTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#001a4d',
    marginBottom: '10px',
  },
  input: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
  },
  primaryButton: {
    padding: '12px',
    background: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  secondaryButton: {
    padding: '12px',
    background: 'transparent',
    color: '#0066cc',
    border: '1px solid #0066cc',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  error: {
    color: '#d63031',
    fontSize: '13px',
    padding: '10px',
    background: '#ffebee',
    borderRadius: '4px',
  },
  demoAccounts: {
    background: '#f0f4ff',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#333',
    marginTop: '15px',
  },
  demoTitle: {
    fontWeight: '600',
    marginBottom: '6px',
  },
  mfaInfo: {
    fontSize: '13px',
    color: '#666',
    marginBottom: '15px',
  },
  header: {
    background: 'white',
    padding: '20px 40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
  },
  headerLogo: {
    width: '40px',
    height: '40px',
    background: '#0066cc',
    color: 'white',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#001a4d',
    margin: '0 0 4px 0',
  },
  headerSubtitle: {
    fontSize: '12px',
    color: '#0066cc',
    margin: 0,
  },
  logoutButton: {
    padding: '8px 16px',
    background: '#f0f0f0',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  adminGrid: {
    maxWidth: '1200px',
    margin: '30px auto',
    padding: '0 20px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '20px',
  },
  summaryRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '15px',
    gridColumn: '1 / -1',
  },
  summaryCard: {
    background: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  summaryLabel: {
    fontSize: '12px',
    color: '#666',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#0066cc',
    marginTop: '8px',
  },
  sectionCard: {
    background: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    gridColumn: '1 / -1',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#001a4d',
    margin: '0 0 15px 0',
  },
  birthdayList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '10px',
  },
  birthdayItem: {
    padding: '10px',
    background: '#f0f4ff',
    borderRadius: '6px',
    fontSize: '13px',
  },
  birthdayName: {
    fontWeight: '600',
    color: '#001a4d',
  },
  birthdayDate: {
    fontSize: '12px',
    color: '#0066cc',
    marginTop: '4px',
  },
  siblingCard: {
    background: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  siblingHeader: {
    marginBottom: '15px',
  },
  siblingName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#001a4d',
    margin: '0 0 4px 0',
  },
  siblingMeta: {
    fontSize: '12px',
    color: '#666',
  },
  siblingStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
    marginBottom: '15px',
    paddingBottom: '15px',
    borderBottom: '1px solid #eee',
  },
  statItem: {},
  statLabel: {
    fontSize: '11px',
    color: '#999',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#0066cc',
  },
  roleAssignedBadge: {
    display: 'inline-block',
    background: '#d4f1d4',
    color: '#2d6a3a',
    padding: '6px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
    marginBottom: '15px',
  },
  loanApprovalSection: {
    marginTop: '15px',
    padding: '15px',
    background: '#fff8e1',
    borderRadius: '6px',
  },
  loanApprovalTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#f39c12',
    margin: '0 0 10px 0',
  },
  loanApprovalItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    fontSize: '13px',
  },
  approveButton: {
    padding: '6px 12px',
    background: '#27ae60',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  portalGrid: {
    maxWidth: '1000px',
    margin: '30px auto',
    padding: '0 20px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '20px',
  },
  dashboardCard: {
    background: 'white',
    padding: '25px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#001a4d',
    margin: '0 0 20px 0',
  },
  balanceSection: {
    textAlign: 'center',
    marginBottom: '25px',
    padding: '20px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '8px',
    color: 'white',
  },
  balanceLabel: {
    fontSize: '12px',
    opacity: 0.9,
    textTransform: 'uppercase',
  },
  balanceValue: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginTop: '8px',
  },
  tierInfo: {
    background: '#f0f4ff',
    padding: '15px',
    borderRadius: '6px',
    marginBottom: '20px',
  },
  tierLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#0066cc',
    marginBottom: '8px',
  },
  tierDetails: {
    fontSize: '12px',
    color: '#666',
    marginBottom: '4px',
  },
  formSection: {
    padding: '15px',
    background: '#fafbfc',
    borderRadius: '6px',
    marginBottom: '20px',
  },
  formSectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#001a4d',
    margin: '0 0 12px 0',
  },
  matchPreview: {
    fontSize: '12px',
    color: '#0066cc',
    marginTop: '8px',
    padding: '8px',
    background: 'white',
    borderRadius: '4px',
  },
  historySection: {
    marginTop: '20px',
    paddingTop: '20px',
    borderTop: '1px solid #eee',
  },
  historyItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    fontSize: '13px',
  },
  historyDate: {
    color: '#999',
    fontSize: '11px',
  },
  historyAmount: {
    fontWeight: '600',
    color: '#001a4d',
  },
  historyMatch: {
    color: '#27ae60',
    fontWeight: '600',
  },
  goalSection: {
    textAlign: 'center',
  },
  goalName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#001a4d',
    marginBottom: '15px',
  },
  progressBar: {
    width: '100%',
    height: '8px',
    background: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '10px',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #0066cc, #00ccff)',
    transition: 'width 0.3s',
  },
  goalProgress: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#0066cc',
    marginBottom: '4px',
  },
  goalSubtext: {
    fontSize: '12px',
    color: '#999',
  },
  loanForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  loanPreview: {
    background: '#f0f4ff',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#0066cc',
    lineHeight: '1.6',
  },
  loanHistorySection: {
    marginTop: '20px',
    paddingTop: '20px',
    borderTop: '1px solid #eee',
  },
  loanStatusItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px',
    background: '#fafbfc',
    borderRadius: '4px',
    marginBottom: '8px',
    fontSize: '13px',
  },
  loanAmount: {
    fontWeight: '600',
    color: '#001a4d',
  },
  loanTerm: {
    fontSize: '11px',
    color: '#999',
    marginTop: '3px',
  },
  loanStatus: {
    padding: '4px 12px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  milestonesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  milestone: (unlocked) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    background: unlocked ? '#d4f1d4' : '#f0f0f0',
    borderRadius: '6px',
    fontSize: '13px',
    color: unlocked ? '#2d6a3a' : '#999',
  }),
};

export default FelsonWealthApp;
