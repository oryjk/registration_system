import 'package:flutter/material.dart';

import '../services/admin_api_client.dart';
import '../services/admin_api_scope.dart';

class CreateMatchPage extends StatefulWidget {
  const CreateMatchPage({super.key});

  @override
  State<CreateMatchPage> createState() => _CreateMatchPageState();
}

class _CreateMatchPageState extends State<CreateMatchPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _dateController = TextEditingController();
  final _playersPerTeamController = TextEditingController();
  final _venueController = TextEditingController();
  final _noteController = TextEditingController();

  String _matchKind = 'external';
  DateTime? _selectedDate;
  TimeOfDay? _selectedTime;
  bool _submitting = false;

  @override
  void dispose() {
    _nameController.dispose();
    _dateController.dispose();
    _playersPerTeamController.dispose();
    _venueController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _pickDateTime() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? now,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 3),
    );
    if (date == null || !mounted) {
      return;
    }

    final time = await showTimePicker(
      context: context,
      initialTime: _selectedTime ?? TimeOfDay.fromDateTime(now),
    );
    if (time == null || !mounted) {
      return;
    }

    setState(() {
      _selectedDate = date;
      _selectedTime = time;
      _dateController.text =
          '${date.year}-${_twoDigits(date.month)}-${_twoDigits(date.day)} '
          '${_twoDigits(time.hour)}:${_twoDigits(time.minute)}';
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    if (_selectedDate == null || _selectedTime == null || _submitting) {
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() => _submitting = true);

    final holdingDate = DateTime(
      _selectedDate!.year,
      _selectedDate!.month,
      _selectedDate!.day,
      _selectedTime!.hour,
      _selectedTime!.minute,
    );
    final now = DateTime.now();
    final registrationEnd = holdingDate.subtract(const Duration(days: 1));

    try {
      final activity = await AdminApiScope.of(context).api.createActivity(
        name: _nameController.text.trim(),
        location: _venueController.text.trim(),
        holdingDate: _formatBackendDateTime(holdingDate),
        startTime: _formatBackendDateTime(now),
        endTime: _formatBackendDateTime(registrationEnd),
        matchKind: _matchKind,
        description: _noteController.text.trim(),
        playersPerTeam: int.tryParse(_playersPerTeamController.text.trim()),
      );
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '比赛已创建：${activity['name'] ?? _nameController.text.trim()}',
          ),
        ),
      );
      Navigator.of(context).pop();
    } on AdminApiException catch (error) {
      _showError(error.message);
    } catch (_) {
      _showError('创建比赛失败，请检查后端服务和网络连接');
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
      appBar: AppBar(title: const Text('创建比赛')),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(
                '基础信息',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 16),
              _Field(
                controller: _nameController,
                label: '比赛名称',
                hintText: '例如：2026 春季联赛',
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return '请输入比赛名称';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 14),
              _Field(
                controller: _dateController,
                label: '比赛时间',
                hintText: '选择日期和时间',
                readOnly: true,
                onTap: _pickDateTime,
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return '请选择比赛时间';
                  }
                  return null;
                },
                suffixIcon: Icons.calendar_month_rounded,
              ),
              const SizedBox(height: 14),
              _Field(
                controller: _venueController,
                label: '比赛地点',
                hintText: '例如：南区体育中心',
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return '请输入比赛地点';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(
                initialValue: _matchKind,
                decoration: const InputDecoration(labelText: '比赛类型'),
                items: const [
                  DropdownMenuItem(value: 'external', child: Text('对外友谊赛')),
                  DropdownMenuItem(value: 'internal', child: Text('队内内战')),
                ],
                onChanged: (value) {
                  if (value == null) {
                    return;
                  }
                  setState(() {
                    _matchKind = value;
                  });
                },
              ),
              const SizedBox(height: 14),
              _Field(
                controller: _playersPerTeamController,
                label: '每队人数',
                hintText: '可选，例如：11',
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 14),
              _Field(
                controller: _noteController,
                label: '备注',
                hintText: '补充赛事规则、分组说明等',
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
                    : const Icon(Icons.verified_rounded),
                label: Text(_submitting ? '提交中...' : '创建比赛'),
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
    this.readOnly = false,
    this.onTap,
    this.maxLines = 1,
    this.suffixIcon,
    this.keyboardType,
  });

  final TextEditingController controller;
  final String label;
  final String hintText;
  final String? Function(String?)? validator;
  final bool readOnly;
  final VoidCallback? onTap;
  final int maxLines;
  final IconData? suffixIcon;
  final TextInputType? keyboardType;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      validator: validator,
      readOnly: readOnly,
      onTap: onTap,
      maxLines: maxLines,
      keyboardType: keyboardType,
      decoration: InputDecoration(
        labelText: label,
        hintText: hintText,
        suffixIcon: suffixIcon == null ? null : Icon(suffixIcon),
      ),
    );
  }
}

String _twoDigits(int value) => value.toString().padLeft(2, '0');

String _formatBackendDateTime(DateTime date) {
  return '${date.year}-${_twoDigits(date.month)}-${_twoDigits(date.day)}T'
      '${_twoDigits(date.hour)}:${_twoDigits(date.minute)}:00';
}
