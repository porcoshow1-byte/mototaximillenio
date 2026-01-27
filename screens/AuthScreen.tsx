
import React, { useState } from 'react';
import { login, register } from '../services/auth';
import { getOrCreateUserProfile } from '../services/user';
import { Button, Input, Card, ConfirmationModal } from '../components/UI';
import { AlertCircle, User, Phone, Car, MapPin, Camera, Building2, FileText, Upload, CheckCircle, Mail } from 'lucide-react';
import { APP_CONFIG } from '../constants';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
import { saveCompany, getMockCompanies } from '../services/company';
import { Company } from '../types';
import { getSettings, subscribeToSettings, SystemSettings, DEFAULT_SETTINGS } from '../services/settings';

export const AuthScreen = ({ role: rawRole, onLoginSuccess, onBack }: { role: string, onLoginSuccess: () => void, onBack: () => void }) => {
  // Handle special 'driver-register' role: default to registration mode
  const isDirectRegistration = rawRole === 'driver-register';
  const role = isDirectRegistration ? 'driver' : rawRole;

  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);

  // Real-time settings
  React.useEffect(() => {
    return subscribeToSettings(setSettings);
  }, []);

  const [isLogin, setIsLogin] = useState(!isDirectRegistration);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');

  const [vehicle, setVehicle] = useState('');
  const [plate, setPlate] = useState('');
  const [cnhFile, setCnhFile] = useState<File | null>(null);

  const [tradeName, setTradeName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [stateInscription, setStateInscription] = useState('');
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Address
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [complement, setComplement] = useState('');

  // Financial
  const [financialManager, setFinancialManager] = useState('');
  const [financialPhone, setFinancialPhone] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const [confirmModal, setConfirmModal] = useState<any>({ isOpen: false });
  const [showForgotPass, setShowForgotPass] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [checkingField, setCheckingField] = useState<string | null>(null);


  // Multi-step Registration (Passenger)
  const [step, setStep] = useState(1);

  const [emailSent, setEmailSent] = useState(false);

  const handleBlur = async (field: string, value: string) => {
    if (!value || isLogin) return; // Only check on registration

    setCheckingField(field);
    setFieldErrors(prev => ({ ...prev, [field]: '' })); // Clear previous error

    // Dynamic import for validators on blur
    if (field === 'cpf' && role !== 'company') {
      const { isValidCPF } = await import('../utils/validators');
      if (!isValidCPF(value)) {
        setFieldErrors(prev => ({ ...prev, cpf: 'CPF inválido.' }));
        setCheckingField(null);
        return;
      }
    }


    try {
      if (role === 'company') {
        if (field === 'cnpj') {
          const { checkCompanyExists } = await import('../services/company');
          const exists = await checkCompanyExists(value);
          if (exists) setFieldErrors(prev => ({ ...prev, cnpj: 'CNPJ já cadastrado.' }));
        }
        else if (field === 'email') {
          const { findCompanyByIdentifier } = await import('../services/company');
          // Re-using findCompany as a check. If returns object, email is taken.
          const exists = await findCompanyByIdentifier(value);
          if (exists) setFieldErrors(prev => ({ ...prev, email: 'E-mail já cadastrado.' }));
        }
      } else {
        // Users / Drivers
        if (field === 'email' || field === 'cpf' || field === 'phone') {
          const { checkUniqueness } = await import('../services/user');
          const result = await checkUniqueness(field as any, value);
          if (result.exists) {
            setFieldErrors(prev => ({ ...prev, [field]: result.message || 'Já cadastrado.' }));
          }
        }
      }
    } catch (error) {
      console.error("Validation error", error);
    } finally {
      setCheckingField(null);
    }
  };



  const handleNextStep = async () => {
    setError('');
    const hasErrors = Object.values(fieldErrors).some(err => err);
    if (hasErrors) return setError('Corrija os campos em vermelho antes de continuar.');

    // Validations for Step 1
    if (!name.trim() || !email.trim() || !phone.trim() || !cpf.trim() || !password) {
      return setError('Preencha os campos (Nome, Email, Celular, CPF, Senha).');
    }
    if (password !== confirmPassword) return setError('As senhas não coincidem.');

    setLoading(true);
    try {
      // Validate CPF format strictly
      const { isValidCPF } = await import('../utils/validators');
      if (!isValidCPF(cpf)) {
        setLoading(false);
        return setError('CPF inválido. Verifique o número digitado.');
      }

      const { checkUniqueness } = await import('../services/constraints');

      const emailCheck = await checkUniqueness('email', email);
      if (emailCheck.exists) { setLoading(false); return setError(emailCheck.message || 'Email já cadastrado.'); }

      const phoneCheck = await checkUniqueness('phone', phone);
      if (phoneCheck.exists) { setLoading(false); return setError(phoneCheck.message || 'Telefone já cadastrado.'); }

      const cpfCheck = await checkUniqueness('cpf', cpf);
      if (cpfCheck.exists) { setLoading(false); return setError(cpfCheck.message || 'CPF já cadastrado.'); }

      setStep(2);
    } catch (e) {
      console.error(e);
      setError('Erro na validação. Tente novamente.');
    } finally {
      // Don't disable loading here if we proceeded to step 2? 
      // Actually we should, because step 2 is just UI switch, no async op there.
      setLoading(false);
    }
  };

  const handleAuth = async () => {
    // Block if any field error exists
    const hasErrors = Object.values(fieldErrors).some(err => err);
    if (hasErrors) {
      setError('Corrija os campos em vermelho antes de continuar.');
      return;
    }

    if (!email || !password) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }  // --- Uniqueness Checks ---
    if (!isLogin) {
      if (password !== confirmPassword) return setError('As senhas não coincidem.');
      if (!name.trim()) return setError('Nome é obrigatório.');
      if (!phone.trim()) return setError('Telefone é obrigatório.');

      // Check CPF
      if (role !== 'company') {
        if (!cpf.trim()) return setError('CPF é obrigatório.');
        const cpfClean = cpf.replace(/\D/g, '');
        if (cpfClean.length !== 11) return setError('CPF inválido.');
      }

      // Check Email & Phone Uniqueness
      setLoading(true);
      try {
        const { checkUniqueness } = await import('../services/constraints');

        const emailCheck = await checkUniqueness('email', email);
        if (emailCheck.exists) {
          setLoading(false);
          return setError(emailCheck.message || 'Email invlálido.');
        }

        const phoneCheck = await checkUniqueness('phone', phone);
        if (phoneCheck.exists) {
          setLoading(false);
          return setError(phoneCheck.message || 'Telefone inválido.');
        }

        if (role !== 'company') {
          const cpfCheck = await checkUniqueness('cpf', cpf);
          if (cpfCheck.exists) {
            setLoading(false);
            return setError(cpfCheck.message || 'CPF inválido.');
          }
        }

        if (role === 'driver') {
          // Note: CPF field does not exist in the form yet, assuming it might be added or we skip for now. 
          // The prompt mentioned CPF check, but the current form only has CNH (file) and basics.
          // If the user meant "when CPF is available", I should add it.
          // For now, I will stick to what's available.
          if (!vehicle.trim()) { setLoading(false); return setError('Modelo do veículo é obrigatório.'); }
          if (!plate.trim()) { setLoading(false); return setError('Placa é obrigatória.'); }
          if (!cnhFile) { setLoading(false); return setError('Foto da CNH é obrigatória.'); }
        }

        if (role === 'company') {
          if (!cnpj.trim()) { setLoading(false); return setError('CNPJ é obrigatório.'); }

          // Algorithmic Validation
          const { isValidCNPJ, isValidCPF } = await import('../utils/validators');
          if (!isValidCNPJ(cnpj)) {
            setLoading(false);
            return setError('CNPJ inválido. Verifique os números digitados.');
          }

          // Check CNPJ Uniqueness
          const cnpjCheck = await checkUniqueness('cnpj', cnpj);
          if (cnpjCheck.exists) {
            setLoading(false);
            return setError(cnpjCheck.message || 'CNPJ já cadastrado.');
          }

          if (!street.trim()) { setLoading(false); return setError('Rua/Logradouro é obrigatório.'); }
          if (!number.trim()) { setLoading(false); return setError('Número é obrigatório.'); }
          if (!neighborhood.trim()) { setLoading(false); return setError('Bairro é obrigatório.'); }
          if (!city.trim() || !state.trim()) { setLoading(false); return setError('Cidade e Estado são obrigatórios (Preencha via CEP).'); }
          if (!cep.trim()) { setLoading(false); return setError('CEP é obrigatório.'); }
          if (!financialManager.trim()) { setLoading(false); return setError('Responsável pela empresa é obrigatório.'); }
          // Company CPF Check
          if (!cpf.trim()) { setLoading(false); return setError('CPF do responsável é obrigatório.'); }

          if (!isValidCPF(cpf)) {
            setLoading(false);
            return setError('CPF do responsável inválido.');
          }

          const cpfCheck = await checkUniqueness('cpf', cpf);
          if (cpfCheck.exists) {
            setLoading(false);
            return setError(cpfCheck.message || 'CPF do responsável já cadastrado.');
          }

          if (!contractFile) { setLoading(false); return setError('Contrato Social é obrigatório.'); }
        }
      } catch (e) {
        console.error("Uniqueness check error", e);
        // Proceed with caution or block? Blocking to be safe.
        // setLoading(false); return setError('Erro ao validar dados. Tente novamente.');
      }
      setLoading(false); // Reset loading only if we are continuing to Auth
    }

    setLoading(true);

    try {
      let finalEmail = email;
      let companyForLogin: any = null;

      // Handle CNPJ/Email Lookup
      if (isLogin && role === 'company') {
        const { findCompanyByIdentifier } = await import('../services/company');
        const company = await findCompanyByIdentifier(email); // email here acts as identifier (email or cnpj)

        if (company) {
          finalEmail = company.email;
          companyForLogin = company;
          // REMOVED: Pre-login Hash Check. We trust Firebase Auth first, then sync.
        } else if (!email.includes('@')) {
          // If user typed a CNPJ and we didn't find it
          throw new Error('Empresa não encontrada com este CNPJ.');
        }
      }

      let userCredential;
      if (isLogin) {
        try {
          userCredential = await login(finalEmail, password);

          // --- Post-Login Sync & Validation ---
          if (role === 'company' && companyForLogin) {
            // If we logged in successfully, but the stored hash doesn't match, 
            // it means the password was changed differently (or just desynced). 
            // We update the hash to match the working password.
            if (companyForLogin.passwordHash && companyForLogin.passwordHash !== password) {
              const { saveCompany } = await import('../services/company');
              await saveCompany({ ...companyForLogin, passwordHash: password });
              console.log('[Auth] Password Hash Synced with Firebase Auth');
            }
          }

        } catch (loginErr: any) {
          // Special Case: Admin-created company (Firestore record exists, but no Firebase Auth User yet)
          if (role === 'company' && companyForLogin && companyForLogin.passwordHash === password && loginErr.code === 'auth/user-not-found') {
            console.log('[Auth] Admin-created company login attempt. Registering new Auth User...');
            // Auto-register the user to "claim" the account
            userCredential = await register(finalEmail, password);

            // We MUST link this new UID to the existing company record
            if (userCredential.user) {
              const { saveCompany } = await import('../services/company');
              const updatedComp = { ...companyForLogin, ownerUid: userCredential.user.uid };
              await saveCompany(updatedComp);
              console.log('[Auth] Company linked to new Auth User:', updatedComp.id);
            }
          } else {
            throw loginErr;
          }
        }

        // Security Check for Companies
        if (role === 'company') {
          try {
            // Use getCompanyByOwner to find company linked to this user
            const { getCompanyByOwner } = await import('../services/company');
            const compData = await getCompanyByOwner(userCredential.user.uid);

            if (!compData) {
              // No company found for this user
              const { logout } = await import('../services/auth');
              await logout();
              throw new Error('Empresa não encontrada. Verifique suas credenciais ou cadastre-se.');
            }

            if (compData.status === 'blocked') {
              const { logout } = await import('../services/auth');
              await logout();
              throw new Error('Acesso bloqueado. Entre em contato com o suporte.');
            }
            if (compData.status === 'pending') {
              const { logout } = await import('../services/auth');
              await logout();
              throw new Error('Cadastro em análise. Aguarde a aprovação.');
            }
            if (compData.isTempPassword) {
              // Store flag for password reset modal
              localStorage.setItem('motoja_needs_password_reset', 'true');
              localStorage.setItem('motoja_company_id', compData.id);
            }
          } catch (checkErr: any) {
            // Propagate our specific errors
            if (checkErr.message.includes('bloqueado') ||
              checkErr.message.includes('análise') ||
              checkErr.message.includes('não encontrada')) {
              throw checkErr;
            }
            console.error('Company check error:', checkErr);
          }
        }
      } else {
        userCredential = await register(email, password);
      }

      const uid = userCredential.user?.uid;

      // File Uploads
      let cnhUrl = '';
      if (!isLogin && (role === 'driver' || role === 'driver-register') && cnhFile && storage) {
        try {
          const storageRef = ref(storage, `drivers / ${uid || Date.now()} _cnh.jpg`);
          await uploadBytes(storageRef, cnhFile);
          cnhUrl = await getDownloadURL(storageRef);
        } catch (uploadError) {
          console.error("Upload failed", uploadError);
        }
      }

      let contractUrl = '';
      if (!isLogin && role === 'company' && contractFile && storage) {
        try {
          const storageRef = ref(storage, `companies / ${uid || Date.now()} _contract.pdf`);
          await uploadBytes(storageRef, contractFile);
          contractUrl = await getDownloadURL(storageRef);
        } catch (uploadError) {
          console.error("Upload failed", uploadError);
        }
      }

      let logoUrl = '';
      if (!isLogin && role === 'company' && logoFile && storage) {
        try {
          const storageRef = ref(storage, `companies / ${uid || Date.now()} _logo.png`);
          await uploadBytes(storageRef, logoFile);
          logoUrl = await getDownloadURL(storageRef);
        } catch (uploadError) {
          console.error("Logo upload failed", uploadError);
        }
      }

      // Profile / Company Creation
      if (userCredential.user) {
        if (role === 'company') {
          if (!isLogin) {
            // Create Company Record (Only for Registration)
            const newCompany: Company = {
              id: uid || `comp_${Date.now()} `,
              name: name,
              tradeName: tradeName,
              cnpj: cnpj,
              stateInscription: stateInscription,
              email: email,
              status: 'pending',
              address: `${street}, ${number} ${complement ? '(' + complement + ')' : ''}, ${neighborhood} - ${city}/${state} - CEP: ${cep}`,
              addressComponents: { street, number, neighborhood, city, state, cep, complement },
              creditLimit: 0,
              usedCredit: 0,
              financialManager: financialManager,
              financialManagerPhone: financialPhone,
              phone: phone,
              contractUrl: contractUrl,
              logoUrl: logoUrl,
              ownerUid: uid,
              isTempPassword: false
            };
            await saveCompany(newCompany);

            // Also create a basic User Profile for session management (validateSession checks 'users' collection)
            await getOrCreateUserProfile(
              uid || `comp_user_${Date.now()}`,
              email,
              'company',
              { name: name }
            );

            setLoading(false);
            setRegistrationSuccess(true);
            return; // STOP here for registration
          }
        } else {
          // Standard User/Driver Profile (Safe for both Login/Register)
          await getOrCreateUserProfile(
            userCredential.user.uid,
            userCredential.user.email || '',
            role === 'driver-register' ? 'driver' : (role as 'user' | 'driver'),
            !isLogin ? {
              name, phone, cpf, vehicle, plate, cnhUrl,
              address: role === 'user' ? `${street}, ${number} ${complement ? '(' + complement + ')' : ''}, ${neighborhood} - ${city}/${state} - CEP: ${cep}` : undefined,
              addressComponents: role === 'user' ? { street, number, neighborhood, city, state, cep, complement } : undefined
            } : undefined
          );

          if (!isLogin) {
            setLoading(false);
            setRegistrationSuccess(true);
            return; // STOP here for registration
          }
        }
      }


      // Register Single Session
      if (userCredential.user) {
        try {
          const { registerSession } = await import('../services/user');
          await registerSession(userCredential.user.uid);
          console.log("✅ Nova sessão registrada:", userCredential.user.uid);
        } catch (sessErr) {
          console.error("Erro ao registrar sessão:", sessErr);
          // Crucial: If session registration fails, we MUST NOT proceed to login,
          // otherwise validateSession will lock the user out immediately.
          const { logout } = await import('../services/auth');
          await logout();
          throw new Error("Falha ao registrar sessão. Tente novamente.");
        }
      }

      onLoginSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.message && (err.message.includes('auth/invalid-credential') || err.message.includes('auth/wrong-password'))) {
        setError('Credenciais incorretas.');
      } else if (err.message && err.message.includes('auth/email-already-in-use')) {
        setError('Este e-mail já está cadastrado.');
      } else if (err.message && err.message.includes('auth/weak-password')) {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else {
        setError('Erro: ' + (err.message || 'Falha na autenticação'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) {
      setConfirmModal({
        isOpen: true,
        title: 'Campo Obrigatório',
        message: 'Digite seu e-mail para recuperar a senha.',
        variant: 'info',
        singleButton: true,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }
    setLoading(true);
    // Simulate Password Reset
    await new Promise(r => setTimeout(r, 1500));
    setConfirmModal({
      isOpen: true,
      title: 'Email Enviado',
      message: `Um link de redefinição de senha foi enviado para ${forgotEmail}`,
      variant: 'success',
      singleButton: true,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setShowForgotPass(false);
      }
    });
    setLoading(false);
  };

  const getRoleInfo = () => {
    switch (role) {
      case 'admin': return { label: 'Administrador', color: 'text-gray-900', bg: 'bg-gray-900', gradient: 'from-gray-800 to-black' };
      case 'driver': return { label: 'Motorista', color: 'text-orange-600', bg: 'bg-orange-600', gradient: 'from-orange-600 to-red-600' };
      case 'company': return { label: 'Empresa', color: 'text-blue-600', bg: 'bg-blue-600', gradient: 'from-blue-600 to-blue-800' };
      default: return { label: 'Passageiro', color: 'text-orange-600', bg: 'bg-orange-600', gradient: 'from-orange-500 to-red-500' };
    }
  };
  const roleInfo = getRoleInfo();

  return (
    <div className="min-h-screen flex bg-white animate-fade-in w-full">
      {/* Left Panel - Image (Visible on Desktop) */}
      <div className={`hidden lg:flex lg:w-1/2 sticky top-0 h-screen relative overflow-hidden bg-gray-900 items-center justify-center`}>
        {/* Background Image Layer - Uses Visual Settings for ALL roles */}
        <div className="absolute inset-0 z-0">
          {settings.visual?.loginBackgroundImage ? (
            <img src={settings.visual!.loginBackgroundImage} className="w-full h-full object-cover opacity-90" alt="Login Background" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${roleInfo.gradient}`}></div>
          )}
        </div>

        {/* Overlay for readability if image fails or needs darkening */}
        <div className="absolute inset-0 bg-black/40 z-10"></div>

        {/* Content on Left Panel - Uses Visual Settings */}
        <div className="relative z-20 p-12 text-white max-w-lg h-full flex flex-col justify-center">
          <div className="flex-1 flex flex-col justify-center">
            <h1 className="text-5xl font-bold mb-4">
              {settings.visual?.loginTitle || APP_CONFIG.name}
            </h1>
            <p className="text-xl opacity-90 leading-relaxed mb-8">
              {settings.visual?.loginSubtitle || 'Conectando destinos, entregando confiança e agilidade para o seu dia a dia.'}
            </p>
          </div>

          <div className="mt-auto">
            <div className="flex items-center gap-4 text-sm font-medium opacity-80 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <span>Sistema Online</span>
              </div>
              <div className="w-px h-4 bg-white/30"></div>
              <span>v1.0.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form (Mobile: Full width/height with potential bg) */}
      <div
        className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 lg:p-12 overflow-y-auto bg-gray-50 lg:bg-white relative z-0"
      >
        {/* Mobile Background Image (Admin only, hidden on Desktop) */}
        {role === 'admin' && settings.visual?.mobileBackgroundImage && (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center lg:hidden z-0"
              style={{ backgroundImage: `url(${settings.visual!.mobileBackgroundImage})` }}
            ></div>
            <div className="absolute inset-0 bg-black/60 lg:hidden z-0"></div>
          </>
        )}

        <div className={`w-full max-w-md bg-white lg:bg-transparent p-6 lg:p-0 rounded-2xl shadow-xl lg:shadow-none relative z-10 ${role === 'admin' && settings.visual?.mobileBackgroundImage ? 'bg-white/85 backdrop-blur-md lg:bg-transparent lg:backdrop-blur-none p-8' : ''}`}>

          {/* Header */}
          {registrationSuccess ? (
            <div className="text-center animate-fade-in py-8">
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail size={40} className="text-orange-600" />
              </div>

              <h2 className="text-3xl font-bold text-gray-900 mb-4">Verifique seu E-mail!</h2>

              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6 text-left">
                <p className="text-gray-700 text-sm mb-2">
                  Um link de confirmação foi enviado para: <br />
                  <span className="font-bold text-gray-900">{email}</span>
                </p>
                <p className="text-gray-500 text-xs">
                  Para sua segurança, valide seu cadastro clicando no link enviado. Verifique também sua caixa de Spam/Lixo Eletrônico.
                </p>
              </div>

              {role === 'company' && (
                <p className="text-gray-500 text-sm mb-6 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                  <span className="font-bold text-yellow-800">Atenção:</span> Além da validação de e-mail, seu cadastro passará por uma análise de crédito e documentos antes da liberação total.
                </p>
              )}

              <Button onClick={() => { setRegistrationSuccess(false); setIsLogin(true); setError(''); setStep(1); }} fullWidth>
                Voltar para Login
              </Button>
            </div>
          ) : (
            <div className="text-center lg:text-left mb-8">
              <button onClick={onBack} className="lg:hidden mb-6 text-gray-500 hover:text-gray-900 flex items-center gap-2 text-sm font-medium">
                &larr; Voltar
              </button>

              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
              </h2>
              <p className="text-gray-500">
                Acesso para <span className={`font-bold uppercase ${roleInfo.color}`}>
                  {roleInfo.label}
                </span>
              </p>
            </div>
          )}

          {!registrationSuccess && error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg flex items-start gap-3 animate-head-shake mb-6">
              <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Form */}
          <div className="space-y-5">
            {/* Display Registration Fields if !isLogin */}
            {!isLogin && (
              <div className="space-y-4 animate-fade-in pb-2">
                {/* Step 1: Personal Data */}
                {(role !== 'user' || step === 1) && (
                  <>
                    <Input
                      label={role === 'company' ? "Razão Social" : "Nome Completo"}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => handleBlur('name', name)}
                      placeholder={role === 'company' ? "Razão Social LTDA" : "Seu nome"}
                      icon={role === 'company' ? <Building2 size={18} /> : <User size={18} />}
                      error={fieldErrors.name}
                    />
                    {/* Moved Email here for step 1 flow if user */}
                    {(role === 'user') && (
                      <Input
                        label="E-mail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => handleBlur('email', email)}
                        placeholder="seu@email.com"
                        icon={<Mail size={18} />}
                        type="email"
                        error={fieldErrors.email}
                      />
                    )}
                  </>
                )}
                {(role !== 'user' || step === 1) && (
                  <>
                    <Input
                      label={role === 'company' ? "Telefone Comercial" : "Celular"}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onBlur={() => handleBlur('phone', phone)}
                      placeholder="(11) 99999-9999"
                      icon={<Phone size={18} />}
                      type="tel"
                      error={fieldErrors.phone}
                    />

                    {role !== 'company' && (
                      <Input
                        label="CPF"
                        value={cpf}
                        onChange={(e) => {
                          // Mascara CPF: 000.000.000-00
                          let v = e.target.value.replace(/\D/g, '');
                          if (v.length > 11) v = v.slice(0, 11);
                          v = v.replace(/(\d{3})(\d)/, '$1.$2');
                          v = v.replace(/(\d{3})(\d)/, '$1.$2');
                          v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                          setCpf(v);
                        }}
                        onBlur={() => handleBlur('cpf', cpf)}
                        placeholder="000.000.000-00"
                        icon={<FileText size={18} />}
                        error={fieldErrors.cpf}
                      />
                    )}
                  </>
                )}

                {/* Step 2: User Address */}
                {role === 'user' && step === 2 && (
                  <div className="space-y-4 animate-fade-in relative">
                    <button
                      onClick={() => setStep(1)}
                      className="text-sm text-gray-500 hover:text-orange-600 flex items-center gap-1 mb-2 font-medium"
                    >
                      &larr; Voltar para Dados Pessoais
                    </button>

                    <div className="flex items-center gap-2 mb-2 text-orange-600 font-bold">
                      <MapPin size={20} />
                      <h3>Endereço Completo</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-1">
                        <Input label="CEP" value={cep} onChange={(e) => {
                          const newCep = e.target.value;
                          setCep(newCep);
                          // Limpa caracteres não numéricos
                          const digits = newCep.replace(/\D/g, '');
                          if (digits.length === 8) {
                            setLoading(true);
                            fetch(`https://viacep.com.br/ws/${digits}/json/`)
                              .then(res => res.json())
                              .then(data => {
                                if (!data.erro) {
                                  setStreet(data.logradouro);
                                  setNeighborhood(data.bairro);
                                  setCity(data.localidade);
                                  setState(data.uf);
                                }
                              })
                              .finally(() => setLoading(false));
                          }
                        }} placeholder="00000-000"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input label="Rua" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Rua Exemplo" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-1">
                        <Input label="Número" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="123" />
                      </div>
                      <div className="col-span-2">
                        <Input label="Bairro" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Bairro" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Cidade" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" />
                      <Input label="UF" value={state} onChange={(e) => setState(e.target.value)} placeholder="SP" maxLength={2} />
                    </div>
                    <Input label="Complemento (Opcional)" value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Apto 101" />
                  </div>
                )}

                {/* Driver Specific Fields */}
                {role === 'driver' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Modelo Veículo" value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Ex: Honda CG" icon={<Car size={18} />} />
                      <Input label="Placa" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="ABC-1234" icon={<MapPin size={18} />} />
                    </div>
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:bg-gray-50 transition cursor-pointer relative group">
                      <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setCnhFile(e.target.files?.[0] || null)} accept="image/*" />
                      <div className="flex flex-col items-center gap-2 text-gray-500 group-hover:text-orange-600 transition-colors">
                        {cnhFile ? <span className="text-green-600 font-bold flex items-center gap-2"><CheckCircle size={16} /> {cnhFile.name}</span> : <><Camera size={24} /> <span>Foto da CNH (Obrigatório)</span></>}
                      </div>
                    </div>
                  </>
                )}

                {/* Company Specific Fields */}
                {role === 'company' && (
                  <div className="space-y-4 pt-2 border-t border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Dados da Empresa</p>

                    {/* Logo Upload */}
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:bg-gray-50 transition cursor-pointer relative group">
                      <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} accept="image/*" />
                      <div className="flex flex-col items-center gap-2 text-gray-500 group-hover:text-blue-600 transition-colors">
                        {logoFile ? <span className="text-green-600 font-bold flex items-center gap-2"><CheckCircle size={16} /> {logoFile.name}</span> : <><Camera size={24} /> <span>Logomarca da Empresa</span></>}
                      </div>
                    </div>

                    <Input label="Nome Fantasia" value={tradeName} onChange={(e) => setTradeName(e.target.value)} placeholder="Nome Comercial" icon={<Building2 size={18} />} />
                    <Input
                      label="CNPJ"
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      onBlur={() => handleBlur('cnpj', cnpj)}
                      placeholder="00.000.000/0001-00"
                      icon={<FileText size={18} />}
                      error={fieldErrors.cnpj}
                    />
                    <Input label="Inscrição Estadual" value={stateInscription} onChange={(e) => setStateInscription(e.target.value)} placeholder="000.000.000.000" />

                    <div className="grid grid-cols-2 gap-4">
                      <Input label="CEP" value={cep} onChange={(e) => {
                        const newCep = e.target.value;
                        setCep(newCep);
                        // Limpa caracteres não numéricos
                        const digits = newCep.replace(/\D/g, '');
                        if (digits.length === 8) {
                          setLoading(true);
                          fetch(`https://viacep.com.br/ws/${digits}/json/`)
                            .then(res => res.json())
                            .then(data => {
                              if (!data.erro) {
                                setStreet(data.logradouro);
                                setNeighborhood(data.bairro);
                                setCity(data.localidade);
                                setState(data.uf);
                              } else {
                                // CEP não encontrado
                                console.warn("CEP não encontrado");
                              }
                            })
                            .catch(err => console.error("Erro ao buscar CEP", err))
                            .finally(() => setLoading(false));
                        }
                      }} placeholder="00000-000" />
                      <Input label="Número" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="123" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <Input label="Endereço" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Rua..." />
                      </div>
                      <div>
                        <Input label="Complemento" value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Apto..." />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Bairro" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Bairro" />
                      <Input label="Cidade/UF" value={city && state ? `${city}/${state}` : ''} onChange={(e) => { /* Manual handling if needed, but composed */ }} placeholder="Cidade - UF" readOnly />
                    </div>

                    <Input label="Responsável pela empresa" value={financialManager} onChange={(e) => setFinancialManager(e.target.value)} placeholder="Nome do responsável" icon={<User size={18} />} />

                    <Input
                      label="CPF do responsável"
                      value={cpf}
                      onChange={(e) => {
                        let v = e.target.value.replace(/\D/g, '');
                        if (v.length > 11) v = v.slice(0, 11);
                        v = v.replace(/(\d{3})(\d)/, '$1.$2');
                        v = v.replace(/(\d{3})(\d)/, '$1.$2');
                        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                        setCpf(v);
                      }}
                      placeholder="000.000.000-00"
                      icon={<FileText size={18} />}
                    />

                    <Input label="Telefone do responsável" value={financialPhone} onChange={(e) => setFinancialPhone(e.target.value)} placeholder="(11) 99999-9999" icon={<Phone size={18} />} />

                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:bg-gray-50 transition cursor-pointer relative group">
                      <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setContractFile(e.target.files?.[0] || null)} accept=".pdf,.img,.jpg" />
                      <div className="flex flex-col items-center gap-2 text-gray-500 group-hover:text-blue-600 transition-colors">
                        {contractFile ? <span className="text-green-600 font-bold flex items-center gap-2"><CheckCircle size={16} /> {contractFile.name}</span> : <><Upload size={24} /> <span>Contrato Social (PDF)</span></>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Email & Password (Always Visible) */}
            {!registrationSuccess && (
              <>
                <div className="space-y-4">
                  {(role !== 'user' || isLogin) && (
                    <Input
                      label={role === 'company' && isLogin ? "E-mail ou CNPJ" : "E-mail de Acesso"}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={role === 'company' && isLogin ? "seu@email.com ou CNPJ" : "seu@email.com"}
                      type={!isLogin && role === 'company' ? 'email' : 'text'}
                    // icon={<User size={18} />}
                    />
                  )}

                  {(role !== 'user' || isLogin || step === 1) && (
                    <div>
                      <Input
                        label="Senha"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="******"
                        type="password"
                      // icon={<Lock size={18} />}
                      />
                      {isLogin && (
                        <div className="flex justify-end mt-1">
                          <button onClick={() => setShowForgotPass(true)} className="text-xs font-medium text-gray-500 hover:text-orange-600 transition-colors">
                            Esqueceu a senha?
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {!isLogin && (role !== 'user' || step === 1) && (
                    <Input
                      label="Confirmar Senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="******"
                      type="password"
                    />
                  )}
                </div>

                <Button
                  onClick={(!isLogin && role === 'user' && step === 1) ? handleNextStep : handleAuth}
                  isLoading={loading}
                  className={`w-full py-3 text-lg font-bold shadow-lg shadow-orange-500/20 ${role === 'admin' ? 'text-white' : ''}`}
                  style={role === 'admin' && settings.visual?.primaryColor ? { backgroundColor: settings.visual!.primaryColor, borderColor: settings.visual!.primaryColor } : {}}
                >
                  {isLogin ? 'Entrar na Plataforma' : (role === 'user' && step === 1 ? 'Próximo' : 'Finalizar Cadastro')}
                </Button>
              </>
            )}

            {/* Toggle Login/Register - HIDE FOR ADMIN */}
            {role !== 'admin' && !registrationSuccess && (
              <div className="text-center pt-4">
                <p className="text-gray-500 text-sm">
                  {isLogin ? 'Ainda não tem conta?' : 'Já possui cadastro?'}
                  <button onClick={() => { setIsLogin(!isLogin); setError(''); setStep(1); }} className="ml-2 font-bold text-orange-600 hover:text-orange-700 hover:underline">
                    {isLogin ? 'Criar Nova Conta' : 'Fazer Login'}
                  </button>
                </p>
              </div>
            )}

            {/* Back button restricted to ADMIN only */}
            {role === 'admin' && (
              <>
                <div className="mt-8 pt-6 border-t border-gray-100 text-center lg:hidden">
                  <button onClick={onBack} className="text-gray-400 hover:text-gray-600 text-sm font-medium">
                    Cancelar e Voltar
                  </button>
                </div>

                <div className="hidden lg:block mt-8 pt-6 border-t border-gray-100 text-center">
                  <button onClick={onBack} className="text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors">
                    &larr; Voltar para a tela inicial
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {
        showForgotPass && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-sm animate-scale-up shadow-2xl">
              <h3 className="text-xl font-bold mb-2 text-gray-900">Recuperar Acesso</h3>
              <p className="text-gray-500 text-sm mb-6">Digite seu email para receber o link de redefinição de senha.</p>
              <Input value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="seu@email.com" className="mb-6" />
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowForgotPass(false)} fullWidth>Cancelar</Button>
                <Button onClick={handleForgotPassword} fullWidth>Enviar Link</Button>
              </div>
            </div>
          </div>
        )
      }
      {
        confirmModal.isOpen && (
          <ConfirmationModal
            isOpen={confirmModal.isOpen}
            title={confirmModal.title}
            message={confirmModal.message}
            onConfirm={confirmModal.onConfirm}
            onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            variant={confirmModal.variant}
            singleButton={confirmModal.singleButton}
            confirmText="OK"
          />
        )
      }
    </div >
  );
};
