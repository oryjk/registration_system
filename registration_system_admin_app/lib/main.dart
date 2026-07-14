import 'package:flutter/material.dart';

import 'pages/admin_home_page.dart';
import 'pages/login_page.dart';
import 'services/admin_api_client.dart';
import 'services/admin_api_scope.dart';
import 'services/admin_session.dart';

void main() {
  runApp(const RegistrationAdminApp());
}

class RegistrationAdminApp extends StatefulWidget {
  const RegistrationAdminApp({super.key});

  @override
  State<RegistrationAdminApp> createState() => _RegistrationAdminAppState();
}

class _RegistrationAdminAppState extends State<RegistrationAdminApp> {
  final _store = AdminSessionStore();

  late Future<_BootstrapState> _bootstrap;
  String _apiBaseUrl = defaultAdminApiBaseUrl;
  String? _accessToken;

  @override
  void initState() {
    super.initState();
    _bootstrap = _loadBootstrapState();
  }

  Future<_BootstrapState> _loadBootstrapState() async {
    final apiBaseUrl = await _store.readApiBaseUrl();
    final token = await _store.readToken();
    _apiBaseUrl = apiBaseUrl;
    _accessToken = token;
    return _BootstrapState(apiBaseUrl: apiBaseUrl, accessToken: token);
  }

  Future<void> _handleSessionChanged(AdminSession? session) async {
    final apiBaseUrl = await _store.readApiBaseUrl();
    setState(() {
      _apiBaseUrl = apiBaseUrl;
      _accessToken = session?.accessToken;
    });
  }

  @override
  Widget build(BuildContext context) {
    const background = Color(0xFF07131B);
    final colorScheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF13B8A6),
      brightness: Brightness.dark,
    );

    return MaterialApp(
      title: '报名系统管理端',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: colorScheme,
        scaffoldBackgroundColor: background,
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          backgroundColor: background,
          foregroundColor: Colors.white,
          centerTitle: false,
        ),
        cardTheme: CardThemeData(
          color: const Color(0xFF0E1A23),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          margin: EdgeInsets.zero,
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            side: const BorderSide(color: Color(0xFF27414F)),
            foregroundColor: Colors.white,
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF0B1820),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0xFF20313A)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0xFF20313A)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0xFF13B8A6), width: 1.5),
          ),
          labelStyle: const TextStyle(color: Color(0xFF9FB2BD)),
          hintStyle: const TextStyle(color: Color(0xFF5E717B)),
        ),
      ),
      home: FutureBuilder<_BootstrapState>(
        future: _bootstrap,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }

          final api = AdminApiClient(
            baseUrl: _apiBaseUrl,
            accessToken: _accessToken,
          );

          return AdminApiScope(
            api: api,
            store: _store,
            onSessionChanged: _handleSessionChanged,
            child: _accessToken == null
                ? const LoginPage()
                : const AdminHomePage(),
          );
        },
      ),
    );
  }
}

class _BootstrapState {
  const _BootstrapState({required this.apiBaseUrl, required this.accessToken});

  final String apiBaseUrl;
  final String? accessToken;
}
