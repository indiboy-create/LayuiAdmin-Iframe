layui.use(['table'], function () {
	'use strict';

	var table = layui.table;

	table.render({
		elem: '#demo-table',
		skin: 'line',
		page: false,
		cols: [
			[
				{ field: 'id', title: '编号', width: 100 },
				{ field: 'name', title: '名称', minWidth: 160 },
				{ field: 'department', title: '部门', width: 140 },
				{ field: 'status', title: '状态', width: 120 },
			],
		],
		data: [
			{ id: '1001', name: '张三', department: '研发中心', status: '正常' },
			{ id: '1002', name: '李四', department: '产品中心', status: '正常' },
			{ id: '1003', name: '王五', department: '运营中心', status: '停用' },
			{ id: '1004', name: '赵六', department: '财务中心', status: '正常' },
		],
	});
});
