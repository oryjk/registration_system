import 'package:flutter/material.dart';

import '../services/admin_api_client.dart';
import '../services/admin_api_scope.dart';
import '../services/admin_session.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _apiBaseUrlController = TextEditingController(
    text: defaultAdminApiBaseUrl,
  );
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _loading = true;
  bool _submitting = false;
  bool _loadedBaseUrl = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_loadedBaseUrl) {
      _loadedBaseUrl = true;
      _loadBaseUrl();
    }
  }

  @override
  void dispose() {
    _apiBaseUrlController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _loadBaseUrl() async {
    final baseUrl = await AdminApiScope.of(context).store.readApiBaseUrl();
    if (!mounted) {
      return;
    }
    setState(() {
      _apiBaseUrlController.text = baseUrl;
      _loading = false;
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || _submitting) {
      return;
    }

    setState(() => _submitting = true);
    final scope = AdminApiScope.of(context);
    final baseUrl = normalizeAdminApiBaseUrl(_apiBaseUrlController.text);
    final api = AdminApiClient(baseUrl: baseUrl);

    try {
      final session = await api.login(
        username: _usernameController.text.trim(),
        password: _passwordController.text,
      );
      await scope.store.saveApiBaseUrl(baseUrl);
      await scope.store.saveSession(session);
      await scope.onSessionChanged(session);
    } on AdminApiException catch (error) {
      _showError(error.message);
    } catch (error) {
      _showError('登录失败：$error');
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  void _showError(String message) {
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.fromLTRB(20, 32, 20, 24),
                children: [
                  Text(
                    '管理端登录',
                    style: theme.textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '使用现有后台管理员账号登录，创建比赛和球队会直接提交到后端。',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: const Color(0xFF9FB2BD),
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: 28),
                  Form(
                    key: _formKey,
                    child: Column(
                      children: [
                        TextFormField(
                          controller: _apiBaseUrlController,
                          decoration: InputDecoration(
                            labelText: '管理端 API 地址',
                            hintText: defaultAdminApiBaseUrl,
                          ),
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return '请输入 API 地址';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _usernameController,
                          decoration: const InputDecoration(labelText: '用户名'),
                          textInputAction: TextInputAction.next,
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return '请输入用户名';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _passwordController,
                          decoration: const InputDecoration(labelText: '密码'),
                          obscureText: true,
                          onFieldSubmitted: (_) => _submit(),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return '请输入密码';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 24),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton.icon(
                            onPressed: _submitting ? null : _submit,
                            icon: _submitting
                                ? const SizedBox.square(
                                    dimension: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Icon(Icons.login_rounded),
                            label: Text(_submitting ? '登录中...' : '登录'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
