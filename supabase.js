// ============================================================
//  GasMaster SaaS - Configuração e Serviço Supabase
//  services/supabase.js
// ============================================================

// ⚠️ IMPORTANTE: Substitua pelos seus dados do Supabase!
// Acesse: https://app.supabase.com → seu projeto → Settings → API

const SUPABASE_URL = 'https://gtlpotitkpqchyeohfwy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0bHBvdGl0a3BxY2h5ZW9oZnd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDc5ODU1OSwiZXhwIjoyMDkwMzc0NTU5fQ.2c-7AyZPud4ZNCHBg_nYSxn46knGN9t1giOHAPLmp_0';

// Inicializa o cliente Supabase
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
//  AUTH SERVICE - Autenticação de usuários
// ============================================================

const AuthService = {

  /**
   * Cadastra um novo usuário
   * @param {string} email
   * @param {string} password
   * @param {string} name - Nome do usuário
   * @returns {Promise}
   */
  async signUp(email, password, name) {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { name, role: 'user' }
      }
    });

    if (error) throw error;

    // Cria perfil do usuário na tabela profiles
    if (data.user) {
      await supabaseClient.from('profiles').insert([{
        id: data.user.id,
        name,
        email,
        role: 'user'
      }]);
    }

    return data;
  },

  /**
   * Login com email e senha
   * @param {string} email
   * @param {string} password
   * @returns {Promise}
   */
  async signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  },

  /**
   * Logout do usuário
   * @returns {Promise}
   */
  async signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  },

  /**
   * Retorna a sessão atual
   * @returns {Promise}
   */
  async getSession() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  /**
   * Retorna o usuário atual com dados do perfil
   * @returns {Promise}
   */
  async getCurrentUser() {
    const session = await this.getSession();
    if (!session) return null;

    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error) return { ...session.user, name: session.user.email, role: 'user' };
    return data;
  },

  /**
   * Observa mudanças no estado de autenticação
   * @param {function} callback
   */
  onAuthStateChange(callback) {
    return supabaseClient.auth.onAuthStateChange(callback);
  },

  /**
   * Reseta senha por email
   * @param {string} email
   * @returns {Promise}
   */
  async resetPassword(email) {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/index.html`
    });
    if (error) throw error;
  }
};

// ============================================================
//  CLIENTES SERVICE
// ============================================================

const ClientesService = {

  /**
   * Lista todos os clientes com filtro e paginação
   * @param {object} options - { search, page, limit }
   * @returns {Promise}
   */
  async listar({ search = '', page = 1, limit = 20 } = {}) {
    let query = supabaseClient
      .from('clientes')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`nome.ilike.%${search}%,telefone.ilike.%${search}%,endereco.ilike.%${search}%`);
    }

    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return { data, count, totalPages: Math.ceil(count / limit) };
  },

  /**
   * Busca um cliente pelo ID
   * @param {string} id
   * @returns {Promise}
   */
  async buscarPorId(id) {
    const { data, error } = await supabaseClient
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Lista todos os clientes (para selects/combos)
   * @returns {Promise}
   */
  async listarTodos() {
    const { data, error } = await supabaseClient
      .from('clientes')
      .select('id, nome, telefone, endereco')
      .order('nome');
    if (error) throw error;
    return data;
  },

  /**
   * Cria um novo cliente
   * @param {object} cliente - { nome, telefone, endereco, observacoes }
   * @returns {Promise}
   */
  async criar(cliente) {
    const { data, error } = await supabaseClient
      .from('clientes')
      .insert([cliente])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Atualiza dados de um cliente
   * @param {string} id
   * @param {object} cliente
   * @returns {Promise}
   */
  async atualizar(id, cliente) {
    const { data, error } = await supabaseClient
      .from('clientes')
      .update({ ...cliente, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Remove um cliente
   * @param {string} id
   * @returns {Promise}
   */
  async excluir(id) {
    // Verifica se há pedidos vinculados
    const { count } = await supabaseClient
      .from('pedidos')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', id);

    if (count > 0) {
      throw new Error(`Este cliente possui ${count} pedido(s) vinculado(s). Remova os pedidos antes de excluir o cliente.`);
    }

    const { error } = await supabaseClient
      .from('clientes')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  /**
   * Retorna total de clientes
   * @returns {Promise<number>}
   */
  async total() {
    const { count, error } = await supabaseClient
      .from('clientes')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count;
  }
};

// ============================================================
//  PEDIDOS SERVICE
// ============================================================

const PedidosService = {

  /**
   * Lista pedidos com filtros
   * @param {object} options - { search, status, clienteId, dataInicio, dataFim, page, limit }
   * @returns {Promise}
   */
  async listar({ search = '', status = '', clienteId = '', dataInicio = '', dataFim = '', page = 1, limit = 20 } = {}) {
    let query = supabaseClient
      .from('pedidos')
      .select(`
        *,
        clientes ( id, nome, telefone, endereco )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    }

    if (dataInicio) {
      query = query.gte('created_at', `${dataInicio}T00:00:00`);
    }

    if (dataFim) {
      query = query.lte('created_at', `${dataFim}T23:59:59`);
    }

    if (search) {
      query = query.or(`numero.ilike.%${search}%,observacoes.ilike.%${search}%`);
    }

    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return { data, count, totalPages: Math.ceil(count / limit) };
  },

  /**
   * Busca pedido por ID
   * @param {string} id
   * @returns {Promise}
   */
  async buscarPorId(id) {
    const { data, error } = await supabaseClient
      .from('pedidos')
      .select(`*, clientes ( * )`)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Cria um novo pedido
   * @param {object} pedido - { cliente_id, quantidade, valor_unitario, observacoes }
   * @returns {Promise}
   */
  async criar(pedido) {
    // Gera número único do pedido
    const numero = `PED-${Date.now().toString().slice(-6)}`;
    const valor_total = (pedido.quantidade || 1) * (pedido.valor_unitario || 0);

    const { data, error } = await supabaseClient
      .from('pedidos')
      .insert([{ ...pedido, numero, valor_total, status: 'pendente' }])
      .select(`*, clientes ( * )`)
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Atualiza um pedido
   * @param {string} id
   * @param {object} pedido
   * @returns {Promise}
   */
  async atualizar(id, pedido) {
    const valor_total = (pedido.quantidade || 1) * (pedido.valor_unitario || 0);

    const { data, error } = await supabaseClient
      .from('pedidos')
      .update({ ...pedido, valor_total, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(`*, clientes ( * )`)
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Atualiza apenas o status do pedido
   * @param {string} id
   * @param {string} status - 'pendente' | 'em_entrega' | 'entregue' | 'cancelado'
   * @returns {Promise}
   */
  async atualizarStatus(id, status) {
    const updates = { status, updated_at: new Date().toISOString() };

    // Registra data de entrega quando concluído
    if (status === 'entregue') {
      updates.entregue_em = new Date().toISOString();
    }

    const { data, error } = await supabaseClient
      .from('pedidos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Remove um pedido
   * @param {string} id
   * @returns {Promise}
   */
  async excluir(id) {
    const { error } = await supabaseClient
      .from('pedidos')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  /**
   * Retorna métricas dos pedidos
   * @returns {Promise}
   */
  async metricas() {
    const { data, error } = await supabaseClient
      .from('pedidos')
      .select('status, valor_total, created_at');
    if (error) throw error;

    const total = data.length;
    const pendentes = data.filter(p => p.status === 'pendente').length;
    const emEntrega = data.filter(p => p.status === 'em_entrega').length;
    const entregues = data.filter(p => p.status === 'entregue').length;
    const faturamento = data
      .filter(p => p.status === 'entregue')
      .reduce((acc, p) => acc + (p.valor_total || 0), 0);
    const faturamentoTotal = data.reduce((acc, p) => acc + (p.valor_total || 0), 0);

    // Pedidos do mês atual
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();
    const doMes = data.filter(p => p.created_at >= inicioMes).length;

    return { total, pendentes, emEntrega, entregues, faturamento, faturamentoTotal, doMes };
  },

  /**
   * Relatório financeiro com filtro por período
   * @param {string} dataInicio
   * @param {string} dataFim
   * @returns {Promise}
   */
  async relatorioFinanceiro({ dataInicio, dataFim }) {
    let query = supabaseClient
      .from('pedidos')
      .select(`*, clientes ( nome )`)
      .order('created_at', { ascending: false });

    if (dataInicio) {
      query = query.gte('created_at', `${dataInicio}T00:00:00`);
    }
    if (dataFim) {
      query = query.lte('created_at', `${dataFim}T23:59:59`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const totalVendas = data.reduce((acc, p) => acc + (p.valor_total || 0), 0);
    const totalEntregues = data.filter(p => p.status === 'entregue').reduce((acc, p) => acc + (p.valor_total || 0), 0);
    const quantidadeEntregue = data.filter(p => p.status === 'entregue').length;

    return { pedidos: data, totalVendas, totalEntregues, quantidadeEntregue };
  },

  /**
   * Retorna últimos pedidos (para dashboard)
   * @param {number} limit
   * @returns {Promise}
   */
  async ultimos(limit = 5) {
    const { data, error } = await supabaseClient
      .from('pedidos')
      .select(`*, clientes ( nome )`)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  }
};

// ============================================================
//  PROFILES SERVICE - Gerenciamento de usuários/equipe
// ============================================================

const ProfilesService = {

  /**
   * Lista todos os perfis (admin only)
   * @returns {Promise}
   */
  async listar() {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .order('created_at');
    if (error) throw error;
    return data;
  },

  /**
   * Atualiza o perfil do usuário logado
   * @param {object} perfil - { name }
   * @returns {Promise}
   */
  async atualizar(id, perfil) {
    const { data, error } = await supabaseClient
      .from('profiles')
      .update(perfil)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Altera a role de um usuário (admin only)
   * @param {string} id
   * @param {string} role - 'admin' | 'user'
   * @returns {Promise}
   */
  async alterarRole(id, role) {
    const { data, error } = await supabaseClient
      .from('profiles')
      .update({ role })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============================================================
//  UTILS - Funções utilitárias
// ============================================================

const Utils = {

  /**
   * Formata valor para BRL
   * @param {number} valor
   * @returns {string}
   */
  formatCurrency(valor) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor || 0);
  },

  /**
   * Formata data para exibição
   * @param {string} dateStr
   * @returns {string}
   */
  formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateStr));
  },

  /**
   * Formata data curta
   * @param {string} dateStr
   * @returns {string}
   */
  formatDateShort(dateStr) {
    if (!dateStr) return '-';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(dateStr));
  },

  /**
   * Retorna a label do status
   * @param {string} status
   * @returns {string}
   */
  statusLabel(status) {
    const labels = {
      pendente: 'Pendente',
      em_entrega: 'Em Entrega',
      entregue: 'Entregue',
      cancelado: 'Cancelado'
    };
    return labels[status] || status;
  },

  /**
   * Retorna o HTML do badge de status
   * @param {string} status
   * @returns {string}
   */
  statusBadge(status) {
    const classes = {
      pendente: 'badge-pending',
      em_entrega: 'badge-delivery',
      entregue: 'badge-delivered',
      cancelado: 'badge-canceled'
    };
    const cls = classes[status] || 'badge-pending';
    return `<span class="badge ${cls}">${Utils.statusLabel(status)}</span>`;
  },

  /**
   * Retorna iniciais do nome
   * @param {string} name
   * @returns {string}
   */
  initials(name) {
    if (!name) return '?';
    return name.split(' ')
      .slice(0, 2)
      .map(n => n[0])
      .join('')
      .toUpperCase();
  },

  /**
   * Formata número de telefone
   * @param {string} phone
   * @returns {string}
   */
  formatPhone(phone) {
    if (!phone) return '-';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  },

  /**
   * Debounce para pesquisa
   * @param {function} fn
   * @param {number} delay
   * @returns {function}
   */
  debounce(fn, delay = 400) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * Exibe toast de notificação
   * @param {string} type - 'success' | 'error' | 'warning' | 'info'
   * @param {string} title
   * @param {string} message
   */
  toast(type, title, message = '') {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-msg">${message}</div>` : ''}
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 350);
    }, 4000);
  },

  /**
   * Confirma ação com diálogo personalizado
   * @param {string} title
   * @param {string} message
   * @returns {Promise<boolean>}
   */
  async confirm(title, message) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay open';
      overlay.innerHTML = `
        <div class="modal" style="max-width:400px">
          <div class="modal-header">
            <div>
              <div class="modal-title">⚠️ ${title}</div>
              <div class="modal-subtitle">${message}</div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="cancel-btn">Cancelar</button>
            <button class="btn btn-danger" id="confirm-btn">Confirmar</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      overlay.querySelector('#cancel-btn').addEventListener('click', () => {
        overlay.remove();
        resolve(false);
      });

      overlay.querySelector('#confirm-btn').addEventListener('click', () => {
        overlay.remove();
        resolve(true);
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
          resolve(false);
        }
      });
    });
  },

  /**
   * Protege rota - redireciona para login se não autenticado
   */
  async requireAuth() {
    const session = await AuthService.getSession();
    if (!session) {
      window.location.href = '/index.html';
      return null;
    }
    return session;
  },

  /**
   * Verifica se usuário é admin
   */
  async requireAdmin() {
    const user = await AuthService.getCurrentUser();
    if (!user || user.role !== 'admin') {
      Utils.toast('error', 'Acesso negado', 'Você não tem permissão para esta ação.');
      return false;
    }
    return true;
  }
};

// ============================================================
//  COMPONENTES REUTILIZÁVEIS
// ============================================================

const Components = {

  /**
   * Renderiza a sidebar com item ativo
   * @param {string} activePage - 'dashboard' | 'clientes' | 'pedidos' | 'financeiro'
   * @param {object} user - usuário logado
   * @returns {string} HTML da sidebar
   */
  sidebar(activePage, user) {
    const items = [
      { id: 'dashboard', icon: '📊', label: 'Dashboard', href: 'dashboard.html' },
      { id: 'clientes', icon: '👥', label: 'Clientes', href: 'clientes.html' },
      { id: 'pedidos', icon: '📦', label: 'Pedidos', href: 'pedidos.html' },
      { id: 'financeiro', icon: '💰', label: 'Financeiro', href: 'financeiro.html' },
    ];

    const adminItems = user?.role === 'admin' ? `
      <div class="nav-section">
        <div class="nav-section-title">Administração</div>
        <a href="equipe.html" class="nav-item ${activePage === 'equipe' ? 'active' : ''}">
          <span class="nav-icon">👤</span> Equipe
        </a>
      </div>
    ` : '';

    const navItems = items.map(item => `
      <a href="${item.href}" class="nav-item ${activePage === item.id ? 'active' : ''}">
        <span class="nav-icon">${item.icon}</span> ${item.label}
      </a>
    `).join('');

    const initials = Utils.initials(user?.name || user?.email || 'U');
    const displayName = user?.name || user?.email || 'Usuário';
    const role = user?.role === 'admin' ? 'Administrador' : 'Usuário';

    return `
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <div class="logo-icon">🔥</div>
          <div class="logo-text">
            <span class="logo-name">GasMaster</span>
            <span class="logo-subtitle">Sistema de Revenda</span>
          </div>
        </div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-section-title">Principal</div>
          ${navItems}
        </div>
        ${adminItems}
      </nav>
      <div class="sidebar-footer">
        <div class="user-card">
          <div class="user-avatar">${initials}</div>
          <div class="user-info">
            <div class="user-name">${displayName}</div>
            <div class="user-role">${role}</div>
          </div>
          <button class="user-logout" id="logout-btn" title="Sair">⏻</button>
        </div>
      </div>
    `;
  },

  /**
   * Inicializa o layout com sidebar e topbar
   * @param {string} page - página ativa
   * @param {string} title - título da página
   * @returns {Promise}
   */
  async initLayout(page, title) {
    const session = await Utils.requireAuth();
    if (!session) return null;

    const user = await AuthService.getCurrentUser();

    // Renderiza sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.innerHTML = this.sidebar(page, user);

    // Título do topbar
    const topTitle = document.getElementById('page-title');
    if (topTitle) topTitle.textContent = title;

    // Evento de logout
    setTimeout(() => {
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
          try {
            await AuthService.signOut();
            window.location.href = 'index.html';
          } catch (err) {
            Utils.toast('error', 'Erro ao sair', err.message);
          }
        });
      }

      // Toggle sidebar mobile
      const sidebarToggle = document.getElementById('sidebar-toggle');
      const sidebarEl = document.getElementById('sidebar');
      const overlayEl = document.getElementById('sidebar-overlay');

      if (sidebarToggle && sidebarEl) {
        sidebarToggle.addEventListener('click', () => {
          sidebarEl.classList.toggle('open');
          if (overlayEl) overlayEl.classList.toggle('open');
        });

        if (overlayEl) {
          overlayEl.addEventListener('click', () => {
            sidebarEl.classList.remove('open');
            overlayEl.classList.remove('open');
          });
        }
      }
    }, 100);

    return user;
  }
};

// Exporta para uso global
window.supabaseClient = supabaseClient;
window.AuthService = AuthService;
window.ClientesService = ClientesService;
window.PedidosService = PedidosService;
window.ProfilesService = ProfilesService;
window.Utils = Utils;
window.Components = Components;