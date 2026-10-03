import 'package:flutter/material.dart';

import '../../state/app_state.dart';
import 'equipment_widgets.dart';
import 'machine_booking_widgets.dart';

class EquipmentCalendarSection extends StatelessWidget {
  const EquipmentCalendarSection({
    super.key,
    required this.state,
    required this.machines,
    required this.selectedMachineId,
    required this.days,
    required this.dayIndex,
    required this.slots,
    required this.loadingMachines,
    required this.loadingSlots,
    required this.isMine,
    required this.onSelectMachine,
    required this.onSelectDay,
    required this.onBook,
    required this.onCancel,
    required this.onWaitlist,
  });

  final AppState state;
  final List<Map<String, dynamic>> machines;
  final String? selectedMachineId;
  final List<DateTime> days;
  final int dayIndex;
  final List<Map<String, dynamic>> slots;
  final bool loadingMachines;
  final bool loadingSlots;
  final bool Function(Map<String, dynamic> slot) isMine;
  final void Function(Map<String, dynamic> machine) onSelectMachine;
  final void Function(int index) onSelectDay;
  final void Function(Map<String, dynamic> slot) onBook;
  final void Function(Map<String, dynamic> slot) onCancel;
  final void Function(Map<String, dynamic> slot) onWaitlist;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (loadingMachines)
          const Center(child: CircularProgressIndicator())
        else if (machines.isEmpty)
          Text(state.tr('equipment.noVerifiedMachines'), style: const TextStyle(fontSize: 12, color: Colors.grey))
        else
          ...machines.map(
            (m) => MachineSelectCard(
              machine: m,
              state: state,
              selected: selectedMachineId == m['id'],
              onTap: () => onSelectMachine(m),
            ),
          ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(state.tr('equipment.weeklySlotCalendar'), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF263238))),
                  Text(state.tr('equipment.ruleMaxTwoSlots'), style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: Colors.grey)),
                ],
              ),
              const SizedBox(height: 10),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (var i = 0; i < days.length; i++) ...[
                      DayCell(
                        day: days[i],
                        state: state,
                        selected: dayIndex == i,
                        onTap: () => onSelectDay(i),
                      ),
                      if (i < days.length - 1) const SizedBox(width: 8),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 12),
              SlotStatusLegend(state: state),
              const SizedBox(height: 12),
              if (loadingSlots)
                const Center(child: CircularProgressIndicator())
              else if (slots.isEmpty)
                Text(state.tr('equipment.noSlotsThisDay'), style: const TextStyle(fontSize: 12, color: Colors.grey))
              else
                ...slots.map(
                  (s) => SlotCard(
                    slot: s,
                    state: state,
                    mine: isMine(s),
                    onBook: () => onBook(s),
                    onCancel: () => onCancel(s),
                    onWaitlist: () => onWaitlist(s),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
