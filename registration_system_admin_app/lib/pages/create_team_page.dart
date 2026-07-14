import 'package:flutter/material.dart';

import '../services/admin_api_client.dart';
import '../services/admin_api_scope.dart';

class CreateTeamPage extends StatefulWidget {
  const CreateTeamPage({super.key});

  @override
  State<CreateTeamPage> createState() => _CreateTeamPageState();
}

class _CreateTeamPageState extends State<CreateTeamPage> {
  final _formKey = GlobalKey<FormState>();
  final _teamNameController = TextEditingController();
  final _captainIdController = TextEditingController();
  final _joinPasswordController = TextEditingController();
  final _descriptionController = TextEditingController();

  String _ageGroup = '不限';
  bool _submitting = false;

  @override
  void dispose() {
    _teamNameController.dispose();
    _captainIdController.dispose();
    _joinPasswordController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() => _submitting = true);

    final descriptionParts = [
      if (_ageGroup != '不限') '年龄组别：$_ageGroup',
      if (_descriptionController.text.trim().isNotEmpty)
        _descriptionController.text.trim(),
    ];

    try {
      final team = await AdminApiScope.of(context).api.createTeam(
        name: _teamNameController.text.trim(),
        description: descriptionParts.join('\n'),
        joinPassword: _joinPasswordController.text.trim(),
        captainId: int.tryParse(_captainIdController.text.trim()),
      );
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '球队已创建：${team['name'] ?? _teamNameController.text.trim()}',
          ),
        ),
      );
      Navigator.of(context).pop();
    } on AdminApiException catch (error) {
      _showError(error.message);
    } catch (_) {
      _showError('创建球队失败，请检查后端服务和网络连接');
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('创建球队')),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(
                '球队资料',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 16),
              _Field(
                controller: _teamNameController,
                label: '球队名称',
                hintText: '例如：城南联队',
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return '请输入球队名称';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(
                initialValue: _ageGroup,
                decoration: const InputDecoration(labelText: '年龄组别'),
                items: const [
                  DropdownMenuItem(value: '不限', child: Text('不限')),
                  DropdownMenuItem(value: 'U12', child: Text('U12')),
                  DropdownMenuItem(value: 'U15', child: Text('U15')),
                  DropdownMenuItem(value: '成年组', child: Text('成年组')),
                ],
                onChanged: (value) {
                  if (value == null) {
                    return;
                  }
                  setState(() {
                    _ageGroup = value;
                  });
                },
              ),
              const SizedBox(height: 14),
              _Field(
                controller: _captainIdController,
                label: '队长用户 ID',
                hintText: '可选，需填写后端已有用户 ID',
                keyboardType: TextInputType.number,
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return null;
                  }
                  if (int.tryParse(value.trim()) == null) {
                    return '请输入数字用户 ID';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 14),
              _Field(
                controller: _joinPasswordController,
                label: '入队密码',
                hintText: '可选',
              ),
              const SizedBox(height: 14),
              _Field(
                controller: _descriptionController,
                label: '球队简介',
                hintText: '球队风格、目标或备注',
                maxLines: 4,
              ),
              const SizedBox(height: 22),
              FilledButton.icon(
                onPressed: _submitting ? null : _submit,
                icon: _submitting
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.group_add_rounded),
                label: Text(_submitting ? '提交中...' : '创建球队'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.label,
    required this.hintText,
    this.validator,
    this.maxLines = 1,
    this.keyboardType,
  });

  final TextEditingController controller;
  final String label;
  final String hintText;
  final String? Function(String?)? validator;
  final int maxLines;
  final TextInputType? keyboardType;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      validator: validator,
      maxLines: maxLines,
      keyboardType: keyboardType,
      decoration: InputDecoration(labelText: label, hintText: hintText),
    );
  }
}
