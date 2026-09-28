import React, { useState, useEffect } from 'react';
import logoImage from './felson-wealth-logo-removebg-preview.png';
import { supabase } from './supabaseClient';

const memberGoalByEmail = {
  'tombra@felsonwealth.com': 'Business Capital',
  'sona@felsonwealth.com': 'Education',
  'bovina@felsonwealth.com': 'Investment',
  'henry@felsonwealth.com': 'Family Support',
  'gift@felsonwealth.com': 'Savings',
};

const redactDiagnosticValue = (value, sensitiveValues) => {
  if (value === null || value === undefined) return null;

  let sanitized = String(value);

  sensitiveValues
    .filter(Boolean)
    .forEach((sensitiveValue) => {
      sanitized = sanitized.split(sensitiveValue).join('[redacted]');
    });

  return sanitized
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/sb_(?:publishable|secret)_[A-Za-z0-9_-]+/g, '[redacted-key]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-token]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .slice(0, 500);
};

const createLoginDiagnostic = (source, error, sensitiveValues) => ({
  source,
  name: redactDiagnosticValue(error?.name, sensitiveValues),
  status: redactDiagnosticValue(error?.status, sensitiveValues),
  code: redactDiagnosticValue(error?.code, sensitiveValues),
  message: redactDiagnosticValue(error?.message, sensitiveValues),
});

const calculateAge = (dateOfBirth) => {
  const today = new Date();
  const birthday = new Date(`${dateOfBirth}T00:00:00`);
  let age = today.getFullYear() - birthday.getFullYear();
  const monthDifference = today.getMonth() - birthday.getMonth();

  if (
    monthDifference < 0
    || (monthDifference === 0 && today.getDate() < birthday.getDate())
  ) {
    age -= 1;
  }

  return age;
};

const loadMemberFinancialData = async (profiles) => {
  if (profiles.length === 0) return [];

  const memberIds = profiles.map((profile) => profile.id);
  const [depositsResult, adjustmentsResult, loansResult] = await Promise.all([
    supabase
      .from('deposits')
      .select('id, member_id, amount, match_amount, deposit_date, affects_balance')
      .in('member_id', memberIds)
      .order('deposit_date', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('balance_adjustments')
      .select('id, member_id, amount, adjustment_type')
      .in('member_id', memberIds),
    supabase
      .from('loans')
      .select('id, member_id, amount, term_months, interest_rate_percent, monthly_payment, total_interest, status, request_date, approved_date, disbursed_date, paid_to_date')
      .in('member_id', memberIds)
      .order('request_date', { ascending: true }),
  ]);

  const queryError = depositsResult.error || adjustmentsResult.error || loansResult.error;
  if (queryError) throw queryError;

  return profiles.map((profile) => {
    const deposits = depositsResult.data.filter(
      (deposit) => deposit.member_id === profile.id,
    );
    const adjustments = adjustmentsResult.data.filter(
      (adjustment) => adjustment.member_id === profile.id,
    );
    const loans = loansResult.data.filter((loan) => loan.member_id === profile.id);

    const depositBalance = deposits
      .filter((deposit) => deposit.affects_balance)
      .reduce(
        (total, deposit) => total + deposit.amount + deposit.match_amount,
        0,
      );
    const adjustmentBalance = adjustments.reduce(
      (total, adjustment) => total + (
        adjustment.adjustment_type === 'debit'
          ? -adjustment.amount
          : adjustment.amount
      ),
      0,
    );

    return {
      id: profile.id,
      name: profile.name,
      age: calculateAge(profile.date_of_birth),
      email: profile.email,
      birthday: profile.date_of_birth,
      tier: profile.tier,
      roleAssigned: profile.role_assigned,
      totalSaved: depositBalance + adjustmentBalance,
      deposits: deposits.map((deposit) => ({
        id: deposit.id,
        date: deposit.deposit_date,
        amount: deposit.amount,
        match: deposit.match_amount,
        affectsBalance: deposit.affects_balance,
      })),
      loans: loans.map((loan) => ({
        id: loan.id,
        amount: loan.amount,
        term: loan.term_months,
        interestRate: loan.interest_rate_percent,
        monthlyPayment: loan.monthly_payment,
        totalInterest: loan.total_interest,
        status: loan.status,
        requestDate: loan.request_date,
        approvedDate: loan.approved_date,
        disbursedDate: loan.disbursed_date,
        paidToDate: loan.paid_to_date,
      })),
      goal: memberGoalByEmail[profile.email.toLowerCase()] || 'Savings',
    };
  });
};

// Felson Wealth Management Portal - Full Stack
const FelsonWealthApp = () => {
  // ============ STATE ============
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null); // 'admin' or 'member'
  const [currentUser, setCurrentUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginDiagnostic, setLoginDiagnostic] = useState(null);
  const [authMessage, setAuthMessage] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [loginPending, setLoginPending] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  // Form state for member portal
  const [loanAmount, setLoanAmount] = useState('');
  const [loanTerm, setLoanTerm] = useState(6);

  // Admin edit state
  const [editingSiblingId, setEditingSiblingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editBirthdayDay, setEditBirthdayDay] = useState('');
  const [editBirthdayMonth, setEditBirthdayMonth] = useState('');
  const [editBirthdayYear, setEditBirthdayYear] = useState('');
  const [editError, setEditError] = useState('');

  // Identity and financial records come from Supabase.
  const [memberProfiles, setMemberProfiles] = useState([]);
  const [siblings, setSiblings] = useState([]);

  // ============ TIER CONFIG ============
  const tiers = {
    1: { name: 'Tier 1', ages: '12-18', minSave: 2500, matchPercent: 35 },
    2: { name: 'Tier 2', ages: '18-25', minSave: 5000, matchPercent: 30 },
    3: { name: 'Tier 3', ages: '25+', minSave: 10000, matchPercent: 25 },
  };

  const getTierForAge = (age) => {
    const ageNum = parseInt(age);
    if (ageNum >= 12 && ageNum <= 18) return 1;
    if (ageNum >= 18 && ageNum <= 25) return 2;
    if (ageNum >= 25) return 3;
    return 1;
  };

  // ============ AUTH ============
  useEffect(() => {
    let isMounted = true;

    const clearAuthenticatedState = () => {
      if (!isMounted) return;
      setIsLoggedIn(false);
      setUserRole(null);
      setCurrentUser(null);
      setMemberProfiles([]);
      setSiblings([]);
    };

    const loadAuthenticatedProfile = async (session) => {
      if (!session?.user) {
        clearAuthenticatedState();
        setAuthLoading(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, name, email, date_of_birth, tier, role, role_assigned')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (error || !profile) {
        clearAuthenticatedState();
        setLoginError(
          error
            ? 'Unable to load your authorized profile. Please try again.'
            : 'This account does not have an authorized Felson Wealth profile.',
        );
        setAuthLoading(false);
        await supabase.auth.signOut();
        return;
      }

      let memberProfiles = [profile];

      if (profile.role === 'admin') {
        const { data, error: memberProfilesError } = await supabase
          .from('profiles')
          .select('id, name, email, date_of_birth, tier, role, role_assigned')
          .eq('role', 'member')
          .order('name');

        if (!isMounted) return;

        if (memberProfilesError) {
          clearAuthenticatedState();
          setLoginError('Unable to load family member profiles. Please try again.');
          setAuthLoading(false);
          await supabase.auth.signOut();
          return;
        }

        memberProfiles = data;
      }

      let memberViews;

      try {
        memberViews = await loadMemberFinancialData(memberProfiles);
      } catch {
        if (!isMounted) return;
        clearAuthenticatedState();
        setLoginError('Unable to load financial records. Please try again.');
        setAuthLoading(false);
        await supabase.auth.signOut();
        return;
      }

      if (!isMounted) return;

      setCurrentUser({
        ...profile,
        birthday: profile.date_of_birth,
        roleAssigned: profile.role_assigned,
      });
      setMemberProfiles(memberProfiles);
      setSiblings(memberViews);
      setUserRole(profile.role);
      setIsLoggedIn(true);
      setLoginError('');
      setAuthLoading(false);
    };

    const initializeSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (error) {
        clearAuthenticatedState();
        setLoginError('Unable to restore your session. Please sign in again.');
        setAuthLoading(false);
        return;
      }

      await loadAuthenticatedProfile(data.session);
    };

    void initializeSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          clearAuthenticatedState();
          setPasswordRecovery(true);
          setLoginError('');
          setAuthMessage('Choose a new password for your account.');
          setAuthLoading(false);
          return;
        }

        if (event === 'SIGNED_OUT') {
          clearAuthenticatedState();
          setAuthLoading(false);
          return;
        }

        if (session) {
          setTimeout(() => {
            void loadAuthenticatedProfile(session);
          }, 0);
        }
      },
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginDiagnostic(null);
    setAuthMessage('');

    const formData = new FormData(e.currentTarget);
    const submittedEmail = String(formData.get('email') || '').trim();
    const submittedPassword = String(formData.get('password') || '');

    if (!submittedEmail || !submittedPassword) {
      setLoginError('Email and password are required');
      return;
    }

    setLoginPending(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: submittedEmail,
        password: submittedPassword,
      });

      if (error) {
        setLoginDiagnostic(createLoginDiagnostic(
          'signInWithPassword returned error',
          error,
          [submittedEmail, submittedPassword],
        ));
        setLoginError(
          error.code === 'invalid_credentials'
            ? 'Invalid email or password'
            : 'Unable to sign in. Please try again.',
        );
        return;
      }

      if (!data.session) {
        setLoginError('Sign-in succeeded, but no session was created. Please try again.');
        return;
      }

      setEmail('');
      setPassword('');
    } catch (error) {
      setLoginDiagnostic(createLoginDiagnostic(
        'signInWithPassword threw exception',
        error,
        [submittedEmail, submittedPassword],
      ));
      setLoginError('Unable to reach the authentication service. Please try again.');
    } finally {
      setLoginPending(false);
    }
  };

  const handleSendPasswordRecovery = async () => {
    setLoginError('');
    setAuthMessage('');

    if (!email.trim()) {
      setLoginError('Enter your email address first');
      return;
    }

    setLoginPending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    });
    setLoginPending(false);

    if (error) {
      setLoginError('Unable to send the password setup link. Please try again.');
      return;
    }

    setAuthMessage('Check your email for a secure password setup link.');
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setLoginError('');

    if (newPassword.length < 12) {
      setLoginError('Use a password with at least 12 characters');
      return;
    }

    setLoginPending(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setLoginPending(false);
      setLoginError('Unable to update your password. Request a new setup link.');
      return;
    }

    await supabase.auth.signOut();
    setNewPassword('');
    setPasswordRecovery(false);
    setLoginPending(false);
    setAuthMessage('Password updated. You can now log in.');
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert('Unable to log out. Please try again.');
      return;
    }

    setIsLoggedIn(false);
    setUserRole(null);
    setCurrentUser(null);
    setMemberProfiles([]);
    setSiblings([]);
    setEmail('');
    setPassword('');
    setLoginError('');
    setEditingSiblingId(null);
  };

  // ============ DEPOSIT HANDLING ============
  const refreshFinancialRecords = async () => {
    try {
      const memberViews = await loadMemberFinancialData(memberProfiles);
      setSiblings(memberViews);
      return true;
    } catch {
      alert('Unable to refresh financial records. Please reload and try again.');
      return false;
    }
  };

  const handleAddDeposit = async (siblingId, amount) => {
    const sibling = siblings.find(s => s.id === siblingId);
    if (!sibling || amount < tiers[sibling.tier].minSave) {
      alert(`Minimum deposit for this tier is ₦${tiers[sibling.tier].minSave}`);
      return false;
    }

    if (userRole !== 'admin') {
      alert('Only Management can record verified deposits.');
      return false;
    }

    const { error } = await supabase.from('deposits').insert({
      member_id: siblingId,
      amount,
      deposit_date: new Date().toISOString().split('T')[0],
    });

    if (error) {
      alert('Unable to record the deposit. No financial data was changed.');
      return false;
    }

    return refreshFinancialRecords();
  };

  // ============ LOAN HANDLING ============
  const handleRequestLoan = async (siblingId, requestedAmount, term) => {
    const sibling = siblings.find(s => s.id === siblingId);
    if (!sibling || sibling.totalSaved < 100000) {
      alert('Minimum ₦100,000 saved required to request loan');
      return false;
    }

    const { error } = await supabase.from('loans').insert({
      member_id: siblingId,
      amount: requestedAmount,
      term_months: term,
    });

    if (error) {
      alert('Unable to submit the loan request. No financial data was changed.');
      return false;
    }

    return refreshFinancialRecords();
  };

  // ============ ADMIN ACTIONS ============
  const handleApproveLoan = async (siblingId, loanId) => {
    const approvalDate = new Date().toISOString().split('T')[0];
    const { error } = await supabase
      .from('loans')
      .update({
        status: 'approved',
        approved_date: approvalDate,
        disbursed_date: approvalDate,
      })
      .eq('id', loanId)
      .eq('member_id', siblingId);

    if (error) {
      alert('Unable to approve the loan. No financial data was changed.');
      return false;
    }

    return refreshFinancialRecords();
  };

  const handleDeleteAccount = (siblingId, siblingName) => {
    if (window.confirm(`Are you sure you want to DELETE the account for ${siblingName}? This cannot be undone.`)) {
      setSiblings(siblings.filter(s => s.id !== siblingId));
      alert(`Account for ${siblingName} has been deleted.`);
    }
  };

  const handleEditAccount = (sibling) => {
    const [year, month, day] = sibling.birthday.split('-');
    setEditingSiblingId(sibling.id);
    setEditName(sibling.name);
    setEditEmail(sibling.email);
    setEditAge(sibling.age.toString());
    setEditBirthdayDay(day);
    setEditBirthdayMonth(month);
    setEditBirthdayYear(year);
    setEditError('');
  };

  const handleSaveEdit = () => {
    setEditError('');

    if (!editName || !editEmail || !editAge || !editBirthdayDay || !editBirthdayMonth || !editBirthdayYear) {
      setEditError('All fields are required');
      return;
    }

    // Check email format
    if (!editEmail.endsWith('@felsonwealth.com')) {
      setEditError('Email must be in format: firstname@felsonwealth.com');
      return;
    }

    // Check if email already exists (excluding current sibling)
    if (siblings.find(s => s.id !== editingSiblingId && s.email === editEmail)) {
      setEditError('Email already registered');
      return;
    }

    const age = parseInt(editAge);
    if (age < 12 || age > 100) {
      setEditError('Age must be between 12 and 100');
      return;
    }

    const day = parseInt(editBirthdayDay);
    const mon = parseInt(editBirthdayMonth);
    const year = parseInt(editBirthdayYear);

    if (day < 1 || day > 31 || mon < 1 || mon > 12 || year < 1900 || year > new Date().getFullYear()) {
      setEditError('Please enter a valid birthday');
      return;
    }

    const birthdayString = `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    setSiblings(siblings.map(s => {
      if (s.id === editingSiblingId) {
        return {
          ...s,
          name: editName,
          email: editEmail,
          age: age,
          birthday: birthdayString,
          tier: getTierForAge(age),
        };
      }
      return s;
    }));

    setEditingSiblingId(null);
    alert('Account updated successfully!');
  };

  // ============ UI COMPONENTS ============
  if (authLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loginCard}>
          <div style={styles.logo}>
            <img src={logoImage} alt="Felson Wealth Management" style={{maxWidth: '300px', height: 'auto', display: 'block', margin: '0 auto'}} />
          </div>
          <h2 style={styles.formTitle}>Loading session...</h2>
        </div>
      </div>
    );
  }

  if (passwordRecovery) {
    return (
      <div style={styles.container}>
        <div style={styles.loginCard}>
          <div style={styles.logo}>
            <img src={logoImage} alt="Felson Wealth Management" style={{maxWidth: '300px', height: 'auto', display: 'block', margin: '0 auto'}} />
          </div>
          <form onSubmit={handleUpdatePassword} style={styles.form}>
            <h2 style={styles.formTitle}>Choose New Password</h2>
            <input
              type="password"
              placeholder="New password (12+ characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              style={styles.input}
            />
            {authMessage && <div style={styles.authMessage}>{authMessage}</div>}
            {loginError && <div style={styles.error}>{loginError}</div>}
            <button
              type="submit"
              disabled={loginPending}
              style={styles.primaryButton}
            >
              {loginPending ? 'Updating...' : 'Set Password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div style={styles.container}>
        <div style={styles.loginCard}>
          <div style={styles.logo}>
            <img src={logoImage} alt="Felson Wealth Management" style={{maxWidth: '300px', height: 'auto', display: 'block', margin: '0 auto'}} />
          </div>

          <form onSubmit={handleLogin} style={styles.form}>
            <h2 style={styles.formTitle}>Login</h2>
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              style={styles.input}
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              style={styles.input}
            />
            {authMessage && <div style={styles.authMessage}>{authMessage}</div>}
            {loginError && <div style={styles.error}>{loginError}</div>}
            {loginDiagnostic && (
              <div style={styles.loginDiagnostic}>
                <strong>Diagnostic:</strong>
                <div>source: {loginDiagnostic.source}</div>
                <div>name: {loginDiagnostic.name ?? 'null'}</div>
                <div>status: {loginDiagnostic.status ?? 'null'}</div>
                <div>code: {loginDiagnostic.code ?? 'null'}</div>
                <div>message: {loginDiagnostic.message ?? 'null'}</div>
              </div>
            )}
            <button
              type="submit"
              disabled={loginPending}
              style={styles.primaryButton}
            >
              {loginPending ? 'Signing in...' : 'Login'}
            </button>
            <div style={styles.signupPrompt}>
              <p style={styles.signupPromptText}>
                Accounts are provisioned by Management.
              </p>
              <button
                type="button"
                onClick={handleSendPasswordRecovery}
                disabled={loginPending}
                style={styles.signupLink}
              >
                Set or reset password
              </button>
            </div>
          </form>
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
              {siblings
                .sort((a, b) => {
                  const getMonth = (bday) => parseInt(bday.split('-')[1]);
                  return getMonth(a.birthday) - getMonth(b.birthday);
                })
                .map((sibling) => (
                  <div key={sibling.id} style={styles.birthdayItem}>
                    <div style={styles.birthdayName}>{sibling.name}</div>
                    <div style={styles.birthdayDate}>
                      {new Date(sibling.birthday + 'T12:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Siblings Overview */}
          {siblings.map((sibling) => {
            const tier = tiers[sibling.tier];
            return editingSiblingId === sibling.id ? (
              // EDIT MODE
              <div key={sibling.id} style={styles.editCard}>
                <h3 style={styles.editTitle}>Edit Account - {sibling.name}</h3>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={styles.input}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  style={styles.input}
                />
                <input
                  type="number"
                  placeholder="Age"
                  value={editAge}
                  onChange={(e) => setEditAge(e.target.value)}
                  style={styles.input}
                />
                <div style={{display: 'flex', gap: '8px'}}>
                  <input
                    type="number"
                    placeholder="Day"
                    value={editBirthdayDay}
                    onChange={(e) => setEditBirthdayDay(e.target.value)}
                    min="1"
                    max="31"
                    style={{...styles.input, flex: 1}}
                  />
                  <input
                    type="number"
                    placeholder="Month"
                    value={editBirthdayMonth}
                    onChange={(e) => setEditBirthdayMonth(e.target.value)}
                    min="1"
                    max="12"
                    style={{...styles.input, flex: 1}}
                  />
                  <input
                    type="number"
                    placeholder="Year"
                    value={editBirthdayYear}
                    onChange={(e) => setEditBirthdayYear(e.target.value)}
                    min="1900"
                    max={new Date().getFullYear()}
                    style={{...styles.input, flex: 1}}
                  />
                </div>
                {editError && <div style={styles.error}>{editError}</div>}
                <div style={{display: 'flex', gap: '8px'}}>
                  <button
                    onClick={handleSaveEdit}
                    style={{...styles.primaryButton, flex: 1}}
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setEditingSiblingId(null)}
                    style={{...styles.secondaryButton, flex: 1}}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // VIEW MODE
              <div key={sibling.id} style={styles.siblingCard}>
                <div style={styles.siblingHeader}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%'}}>
                    <div style={{flex: 1}}>
                      <h3 style={styles.siblingName}>{sibling.name}</h3>
                      <div style={styles.siblingMeta}>
                        Age {sibling.age} • {tier.name}
                      </div>
                      <div style={{fontSize: '11px', color: '#666', marginTop: '4px'}}>{sibling.email}</div>
                    </div>
                    <div style={{display: 'flex', gap: '6px', flexDirection: 'column'}}>
                      <button
                        onClick={() => handleEditAccount(sibling)}
                        style={styles.editButton}
                        title="Edit account"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(sibling.id, sibling.name)}
                        style={styles.deleteButton}
                        title="Delete account"
                      >
                        Delete
                      </button>
                    </div>
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

                {/* Admin Deposit Form */}
                <div style={styles.adminDepositForm}>
                  <h4 style={styles.adminDepositTitle}>Record Deposit</h4>
                  <div style={{display: 'flex', gap: '8px'}}>
                    <input
                      type="number"
                      placeholder={`Min: ₦${tier.minSave}`}
                      id={`deposit-${sibling.id}`}
                      style={styles.input}
                    />
                    <button
                      onClick={async () => {
                        const amount = parseInt(document.getElementById(`deposit-${sibling.id}`).value);
                        if (amount >= tier.minSave) {
                          const saved = await handleAddDeposit(sibling.id, amount);
                          if (saved) {
                            document.getElementById(`deposit-${sibling.id}`).value = '';
                          }
                        }
                      }}
                      style={styles.adminDepositButton}
                    >
                      Record
                    </button>
                  </div>
                </div>

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
            );
          })}
        </div>
      </div>
    );
  }

  // ============ MEMBER PORTAL ============
  if (userRole === 'member' && currentUser) {
    const sibling = siblings.find(
      (s) => s.email.toLowerCase() === currentUser.email.toLowerCase(),
    );

    if (!sibling) {
      return (
        <div style={styles.container}>
          <div style={styles.header}>
            <div style={styles.headerLeft}>
              <div style={styles.headerLogo}>F</div>
              <div>
                <h1 style={styles.headerTitle}>Felson Wealth</h1>
                <p style={styles.headerSubtitle}>{currentUser.name}</p>
              </div>
            </div>
            <button onClick={handleLogout} style={styles.logoutButton}>
              Logout
            </button>
          </div>
          <div style={styles.dashboardCard}>
            <h2 style={styles.cardTitle}>Member access is being prepared</h2>
            <p>Your profile is active, but financial records are not connected yet.</p>
          </div>
        </div>
      );
    }

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

            {/* Deposit History */}
            {sibling.deposits.length > 0 && (
              <div style={styles.historySection}>
                <h3 style={styles.formSectionTitle}>Recent Deposits</h3>
                {sibling.deposits.map((dep) => (
                  <div key={dep.id} style={styles.historyItem}>
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
                  onClick={async () => {
                    if (loanAmount) {
                      const submitted = await handleRequestLoan(
                        sibling.id,
                        parseInt(loanAmount),
                        loanTerm,
                      );
                      if (submitted) setLoanAmount('');
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
    maxWidth: '450px',
    margin: '40px auto',
    background: 'white',
    borderRadius: '12px',
    padding: '40px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
  },
  logo: {
    textAlign: 'center',
    marginBottom: '30px',
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
  loginDiagnostic: {
    color: '#5a3e00',
    fontSize: '12px',
    lineHeight: '1.5',
    padding: '10px',
    background: '#fff8e1',
    borderRadius: '4px',
    overflowWrap: 'anywhere',
  },
  authMessage: {
    color: '#176b3a',
    fontSize: '13px',
    padding: '10px',
    background: '#eaf7ef',
    borderRadius: '4px',
  },
  mfaInfo: {
    fontSize: '13px',
    color: '#666',
    marginBottom: '15px',
  },
  signupPrompt: {
    textAlign: 'center',
    marginTop: '10px',
  },
  signupPromptText: {
    fontSize: '13px',
    color: '#666',
    margin: '0 0 8px 0',
  },
  signupLink: {
    background: 'none',
    border: 'none',
    color: '#0066cc',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    textDecoration: 'underline',
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
  editCard: {
    background: '#f0f4ff',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  editTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#001a4d',
    marginBottom: '15px',
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
  adminDepositForm: {
    marginTop: '15px',
    padding: '12px',
    background: '#f0f4ff',
    borderRadius: '6px',
  },
  adminDepositTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#0066cc',
    margin: '0 0 10px 0',
  },
  adminDepositButton: {
    padding: '8px 16px',
    background: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
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
  editButton: {
    padding: '6px 12px',
    background: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '11px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  resetButton: {
    padding: '6px 12px',
    background: '#f39c12',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '11px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  deleteButton: {
    padding: '6px 12px',
    background: '#e74c3c',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '11px',
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
